from django import forms
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_http_methods

from .models import CaseEvent, CaseMessage, Organization, SupportCase, User
from .organization_models import OrganizationEvent, OrganizationRequest, OrganizationRequestMessage
from .staff_access import assignable_teams, has_desk, memberships, scope, team_role
from .staff_models import INTAKE_TEAM, StaffAssignment, StaffMembership, StaffOrganizationNote, StaffTeam


MODELS = {"mp": SupportCase, "org": OrganizationRequest}
CLOSED = {"resolved", "closed"}
VIEWS = (("open", "Открытые"), ("mine", "Мои"), ("unassigned", "Без ответственного"),
         ("overdue", "Просроченные"), ("closed", "Завершённые"))


def records(model, user):
    return scope(model.objects.all(), user).select_related("staff_assignment__team", "staff_assignment__assignee")


def record_url(record):
    return reverse("staff_case", args=["mp" if isinstance(record, SupportCase) else "org", record.public_id])


def desk_context(request, **extra):
    return {"sandbox": getattr(settings, "STAFF_SANDBOX", False),
            "desk_groups": memberships(request.user).select_related("team"), **extra}


@login_required
@require_GET
def queue(request):
    if not has_desk(request.user):
        raise PermissionDenied
    view = request.GET.get("view", "open")
    view = view if view in dict(VIEWS) else "open"
    kind = request.GET.get("kind", "")
    term = request.GET.get("q", "").strip()[:100]
    rows = []
    for prefix, model in MODELS.items():
        if kind in MODELS and kind != prefix:
            continue
        items = records(model, request.user)
        items = items.filter(status__in=CLOSED) if view == "closed" else items.exclude(status__in=CLOSED)
        if view == "mine":
            items = items.filter(staff_assignment__assignee=request.user)
        elif view == "unassigned":
            items = items.filter(staff_assignment__assignee__isnull=True)
        elif view == "overdue":
            items = items.filter(staff_assignment__due__lt=timezone.now())
        if term:
            query = Q(title__icontains=term)
            ref, _, number = term.upper().rpartition("-")
            if ref == prefix.upper() and number.isdecimal() and len(number) <= 16:
                query |= Q(pk=int(number))
            items = items.filter(query)
        rows.extend(items.order_by("-updated_at", "-pk")[:60])
    rows.sort(key=lambda item: item.updated_at, reverse=True)
    for item in rows[:60]:
        item.desk_url = record_url(item)
        item.desk_assignment = getattr(item, "staff_assignment", None)
    return render(request, "staff/queue.html", desk_context(
        request, items=rows[:60], selection=view, kind=kind, term=term, views=VIEWS,
    ))


class StepForm(forms.Form):
    version = forms.CharField(widget=forms.HiddenInput)
    status = forms.ChoiceField(choices=SupportCase.Status.choices, label="Статус")
    next_step = forms.CharField(max_length=1200, required=False, label="Следующий шаг для заявителя",
                                widget=forms.Textarea(attrs={"rows": 3}))
    due = forms.DateTimeField(required=False, label="Следующий контакт по Москве",
                               input_formats=["%Y-%m-%dT%H:%M"],
                               widget=forms.DateTimeInput(format="%Y-%m-%dT%H:%M", attrs={"type": "datetime-local"}))


class AssignmentForm(forms.Form):
    version = forms.CharField(widget=forms.HiddenInput)
    team = forms.ModelChoiceField(queryset=StaffTeam.objects.none(), label="Команда")
    assignee = forms.ModelChoiceField(queryset=User.objects.none(), required=False, label="Ответственный",
                                      empty_label="В очередь команды")

    def __init__(self, actor, record, *args, **kwargs):
        super().__init__(*args, **kwargs)
        teams = assignable_teams(actor, record)
        self.fields["team"].queryset = teams
        self.fields["assignee"].queryset = User.objects.filter(
            is_active=True, staffmembership__active=True, staffmembership__team__in=teams,
        ).distinct().order_by("display_name", "pk")
        self.fields["assignee"].label_from_instance = lambda person: person.display_name or f"Сотрудник №{person.pk}"

    def clean(self):
        data = super().clean()
        team, person = data.get("team"), data.get("assignee")
        if team and person and not StaffMembership.objects.filter(team=team, user=person, active=True).exists():
            self.add_error("assignee", "Выберите действующего сотрудника из указанной команды.")
        return data


class ReplyForm(forms.Form):
    version = forms.CharField(widget=forms.HiddenInput)
    body = forms.CharField(max_length=4000, label="Текст", widget=forms.Textarea(attrs={"rows": 4}))


def active_partner(case):
    org = case.partner_organization
    if org and (
        org.is_approved and case.partner_sharing_approved and case.partner_consent_record.strip()
        and case.partner_summary.strip() and org.kind not in {Organization.Kind.EMPLOYER, Organization.Kind.STAFFING}
    ):
        return org
    return None


def conversation(record):
    recent = record.messages.select_related("author").order_by("-created_at", "-pk")[:100]
    if isinstance(record, SupportCase):
        return [(m.created_at, m.author, m.body, m.get_audience_display()) for m in recent]
    items = [(m.created_at, m.author, m.body, "Переписка с организацией") for m in recent]
    notes = record.staff_notes.select_related("author").order_by("-created_at", "-pk")[:100]
    items.extend((note.created_at, note.author, note.body, "Только сотрудники") for note in notes)
    return sorted(items, key=lambda item: item[0], reverse=True)[:100]


def audit(record, actor, event, detail):
    if isinstance(record, SupportCase):
        CaseEvent.objects.create(case=record, actor=actor, event_type=event, detail=detail)
    else:
        OrganizationEvent.objects.create(request=record, organization=record.organization, actor=actor,
                                         event_type=event, detail=detail)


def update_record(record, actor, action, data, assignment):
    is_case = isinstance(record, SupportCase)
    if action == "step":
        before = record.status
        record.status = data["status"]
        assignment.next_step = data["next_step"]
        assignment.due = data["due"]
        assignment.save()
        if is_case:
            record.next_step = assignment.next_step
        record.save()
        audit(record, actor, "staff_step", {"from": before, "to": record.status, "due": bool(assignment.due)})
        return
    if action == "assign":
        before = assignment.team_id
        assignment.team, assignment.assignee = data["team"], data["assignee"]
        assignment.save()
        if is_case:
            record.coordinator = assignment.assignee
        record.save()
        audit(record, actor, "staff_assigned",
              {"from_team": before, "team": assignment.team_id, "assignee": assignment.assignee_id})
        return
    if is_case:
        partner = active_partner(record) if action == "partner" else None
        audience = {"reply": CaseMessage.Audience.APPLICANT, "note": CaseMessage.Audience.INTERNAL,
                    "partner": CaseMessage.Audience.PARTNER}[action]
        msg = CaseMessage.objects.create(case=record, author=actor, audience=audience,
                                         partner_organization=partner, body=data["body"])
        detail = {"audience": audience, "message": msg.pk}
    elif action == "note":
        note = StaffOrganizationNote.objects.create(request=record, author=actor, body=data["body"])
        detail = {"note": note.pk}
    else:
        msg = OrganizationRequestMessage.objects.create(request=record, author=actor, is_staff_reply=True, body=data["body"])
        detail = {"message": msg.pk}
    record.save(update_fields=["updated_at"])
    audit(record, actor, "staff_note" if action == "note" else "staff_message", detail)


@login_required
@require_http_methods(["GET", "POST"])
def case_detail(request, kind, public_id):
    if kind not in MODELS:
        raise Http404
    if not has_desk(request.user):
        raise PermissionDenied
    model = MODELS[kind]
    with transaction.atomic():
        if request.method == "POST":
            list(memberships(request.user).select_for_update().values_list("pk", flat=True))
            get_object_or_404(scope(model.objects.all(), request.user), public_id=public_id)
            get_object_or_404(model.objects.select_for_update(), public_id=public_id)
        record = get_object_or_404(records(model, request.user), public_id=public_id)
        assignment = getattr(record, "staff_assignment", None)
        version = record.updated_at.isoformat()
        team = assignment.team if assignment else StaffTeam.objects.get(slug=INTAKE_TEAM)
        role = team_role(request.user, record)
        can_manage = role in {StaffMembership.Role.LEAD, StaffMembership.Role.COORDINATOR}
        partner = active_partner(record) if kind == "mp" else None
        external = settings.PORTAL_INTAKE_MODE in {"test", "live"} and record.status not in CLOSED
        actions = {"note": ReplyForm}
        if can_manage:
            actions.update({"step": StepForm, "assign": AssignmentForm})
            if external:
                actions["reply"] = ReplyForm
                if partner:
                    actions["partner"] = ReplyForm
        action = request.POST.get("action", "") if request.method == "POST" else ""
        if request.method == "POST" and action not in actions:
            raise PermissionDenied
        next_step = record.next_step if kind == "mp" else assignment.next_step if assignment else ""
        initial = {"version": version, "status": record.status, "next_step": next_step, "team": team,
                   "assignee": assignment.assignee if assignment else None,
                   "due": timezone.localtime(assignment.due) if assignment and assignment.due else None}
        form_set = {}
        for name, form_class in actions.items():
            args = (request.user, record) if name == "assign" else ()
            form_set[name] = form_class(*args, data=request.POST if action == name else None,
                                       initial=initial, auto_id=f"{name}_%s")
        status = 200
        if action:
            form = form_set[action]
            if not form.is_valid():
                status = 400
            elif form.cleaned_data["version"] != version:
                form.add_error(None, "Дело уже обновлено. Откройте актуальную карточку и повторите действие.")
                status = 409
            else:
                if action in {"step", "assign"} and assignment is None:
                    subject = {"case": record} if kind == "mp" else {"org_request": record}
                    assignment = StaffAssignment.objects.create(team=team, **subject)
                update_record(record, request.user, action, form.cleaned_data, assignment)
                messages.success(request, "Изменение сохранено.")
                if not scope(model.objects.all(), request.user).filter(pk=record.pk).exists():
                    return redirect("staff_queue")
                return redirect(record_url(record))
        context = desk_context(request, record=record, assignment=assignment, team=team,
            participant=record.owner.display_name if kind == "mp" else record.organization.name,
            description=record.description if kind == "mp" else record.body,
            partner=partner, thread=conversation(record), timeline=record.events.select_related("actor")[:30],
            forms=form_set, external=external,
        )
    return render(request, "staff/case.html", context, status=status)
