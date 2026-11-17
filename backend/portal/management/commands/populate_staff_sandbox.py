from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from portal.access import approved_organizations
from portal.models import CaseEvent, CaseMessage, Organization, SupportCase, User, UserWorkspace, WorkspaceEvent
from portal.organization_api import validate_workspace
from portal.organization_models import (
    OrganizationEvent, OrganizationRequest, OrganizationRequestMessage, OrganizationWorkspace, empty_organization_workspace,
)
from portal.platform_controls import DEFAULT_ENABLED, ORG_MODULES, PERSONAL_SEEDS, FeatureSetting
from portal.sandbox_examples import example_id, organization_examples, personal_examples
from portal.staff_models import StaffAssignment, StaffTeam
from portal.workspace_api import validate_data


def merge_examples(current, examples, defaults):
    merged = dict(current)
    for field, value in examples.items():
        previous = current.get(field, defaults.get(field))
        if isinstance(value, dict) and isinstance(previous, (dict, type(None))):
            default_group = defaults.get(field) or {}
            merged[field] = merge_examples(previous or {}, value, default_group)
        elif isinstance(value, list) and isinstance(previous, (list, type(None))):
            items = list(previous or [])
            existing = [item.get("id") if isinstance(item, dict) else item for item in items]
            merged[field] = items + [item for item in value if (item.get("id") if isinstance(item, dict) else item) not in existing]
        elif field not in current or previous == defaults.get(field):
            merged[field] = value
    return merged


def enable_examples(user, organization):
    features = [("personal." + key, "pilot_users", user) for key in PERSONAL_SEEDS]
    features += [("organization." + key, "pilot_organizations", organization) for key in ORG_MODULES]
    for key, audience, recipient in features:
        if key in DEFAULT_ENABLED:
            continue
        row, _ = FeatureSetting.objects.get_or_create(key=key, defaults={"mode": FeatureSetting.Mode.PILOT})
        if row.mode == FeatureSetting.Mode.OFF:
            row.mode = FeatureSetting.Mode.PILOT
            row.save(update_fields=["mode"])
        if row.mode == FeatureSetting.Mode.PILOT:
            getattr(row, audience).add(recipient)


def populate_workspaces(user, organization):
    personal, _ = UserWorkspace.objects.select_for_update().get_or_create(owner=user)
    next_data = merge_examples(personal.data, personal_examples(), {"modules": PERSONAL_SEEDS})
    if not validate_data(next_data):
        raise CommandError("Invalid personal example data.")
    if personal.data != next_data:
        personal.data = next_data
        personal.revision += 1
        personal.save(update_fields=["data", "revision", "updated_at"])
        WorkspaceEvent.objects.create(owner=user, revision=personal.revision)

    workspace, _ = OrganizationWorkspace.objects.select_for_update().get_or_create(organization=organization)
    next_data = validate_workspace(merge_examples(workspace.data, organization_examples(), empty_organization_workspace()))
    if workspace.data != next_data:
        workspace.data = next_data
        workspace.revision += 1
        workspace.save(update_fields=["data", "revision", "updated_at"])
        OrganizationEvent.objects.create(organization=organization, event_type="sandbox_examples",
                                         detail={"revision": workspace.revision})


class Command(BaseCommand):
    help = "Populate the existing synthetic staff sandbox accounts with linked examples."

    @transaction.atomic
    def handle(self, *args, **kwargs):
        if not getattr(settings, "STAFF_SANDBOX", False) or settings.PORTAL_INTAKE_MODE != "test":
            raise CommandError("This command requires the isolated staff sandbox.")
        users = {}
        for role in ("coordinator", "specialist", "migrant", "partner"):
            try:
                users[role] = User.objects.get(email=f"{role}@most.example", is_active=True)
            except User.DoesNotExist as error:
                raise CommandError("Initialize the sandbox accounts first.") from error
        try:
            organization = approved_organizations(users["partner"]).get(name="Учебный центр адаптации")
        except Organization.DoesNotExist as error:
            raise CommandError("The synthetic partner organization is unavailable.") from error
        fund = StaffTeam.objects.get(slug="fund")
        institute = StaffTeam.objects.get(slug="institute")
        enable_examples(users["migrant"], organization)
        populate_workspaces(users["migrant"], organization)
        cases = self.populate_cases(users, organization, fund, institute)
        requests = self.populate_requests(users, organization, fund)
        self.stdout.write("Обращения мигранта: " + ", ".join(f"{item.reference} {item.title}" for item in cases))
        self.stdout.write("Заявки организации: " + ", ".join(f"{item.reference} {item.title}" for item in requests))

    @staticmethod
    def populate_cases(users, organization, fund, institute):
        owner, coordinator, specialist, partner = (users[key] for key in ("migrant", "coordinator", "specialist", "partner"))
        now = timezone.now()
        status, category = SupportCase.Status, SupportCase.Category

        def add(key, title, body, topic, stage, team=None, assignee=None, due=None, messages=(), **fields):
            case, created = SupportCase.objects.get_or_create(public_id=example_id(key), defaults={
                "owner": owner, "title": title, "description": body, "category": topic,
                "status": stage, "city": "Москва", "preferred_language": "ru",
                "is_test": True, "policy_version": "synthetic-test", "consented_at": now, **fields,
            })
            if created:
                case.full_clean()
                CaseEvent.objects.create(case=case, actor=owner, event_type="created", detail={"test": True})
                if team is not None:
                    StaffAssignment.objects.create(case=case, team=team, assignee=assignee, due=due)
                    CaseEvent.objects.create(case=case, actor=coordinator, event_type="staff_assigned",
                                             detail={"team": team.slug, "test": True})
                for author, audience, text in messages:
                    CaseMessage.objects.create(case=case, author=author, audience=audience, body=text,
                                               partner_organization=organization if audience == CaseMessage.Audience.PARTNER else None)
            return case

        audience = CaseMessage.Audience
        return [
            add("consultation-case", "Подготовиться к первой консультации",
                "Учебное обращение Азиза. Мне удобнее вечером. Хочу узнать, как будет проходить первая встреча.",
                category.ADAPTATION, status.WAITING, fund, coordinator, now + timedelta(days=2),
                messages=(
                    (owner, audience.APPLICANT, "Мне удобнее после работы. Можно ли провести первую встречу вечером?"),
                    (coordinator, audience.APPLICANT, "Выберите удобное время. Учебный центр может предложить утро или вечер."),
                    (coordinator, audience.INTERNAL, "Учебная внутренняя заметка: перед ответом сверить время с командой."),
                    (partner, audience.PARTNER, "Для учебного сценария можем предложить утро или вечер. Подтвердите удобный вариант."),
                ),
                next_step="Ответьте в переписке, когда удобнее встретиться: утром или вечером.",
                partner_organization=organization, partner_sharing_approved=True,
                partner_consent_record="Вымышленное согласие Азиза на передачу только краткого описания учебному центру.",
                partner_summary="Предложить время вводной консультации и объяснить, как подготовить вопросы к первой встрече.",
                partner_next_step="Предложите два учебных варианта времени для вводной консультации."),
            add("unassigned-case", "Уточнить, как подготовить вопросы о жилье",
                "Учебное обращение. Нужно разобрать, какие сведения об условиях проживания стоит записать.",
                category.ADAPTATION, status.NEW),
            add("specialist-case", "Уточнить график и перерывы в образце договора",
                "Учебное обращение. В образце указаны смены по восемь часов, время перерывов неясно.",
                category.EMPLOYMENT, status.IN_PROGRESS, institute, specialist, now - timedelta(days=1),
                messages=((specialist, audience.INTERNAL,
                           "Учебное заключение для команды: уточнить график, порядок учёта времени и даты оплаты."),),
                next_step="Подготовьте перечень вопросов о графике и оплате."),
            add("resolved-case", "Получить памятку после вводной встречи",
                "Учебное обращение. Нужна краткая памятка с итогами беседы.",
                category.ADAPTATION, status.RESOLVED, fund, coordinator,
                messages=((coordinator, audience.APPLICANT, "Памятка подготовлена. Учебное обращение завершено."),),
                next_step="Посмотрите памятку и перенесите нужные шаги в свой план."),
        ]

    @staticmethod
    def populate_requests(users, organization, fund):
        coordinator, partner = users["coordinator"], users["partner"]
        now = timezone.now()
        examples = (
            ("consultation-request", "Согласовать расписание вводной консультации", OrganizationRequest.Category.ADAPTATION,
             "Первая консультация: в учебном центре есть утренний и вечерний варианты.", "consultation-project",
             OrganizationRequest.Status.WAITING, "Уточните, кто из команды проведёт встречу.",
             "Утро и вечер подходят. Сообщите, кто из команды будет вести вводную встречу."),
            ("language-request", "Подвести итоги разговорного клуба", OrganizationRequest.Category.EVENT,
             "Учебная команда провела встречу на тему «Как спросить о графике работы».", "language-project",
             OrganizationRequest.Status.RESOLVED, "Добавьте итоговые материалы к проекту.",
             "Учебный отчёт принят. Итого по клубу можно посмотреть в разделе «Отчёты»."),
        )
        items = []
        for key, title, category, body, project, status, step, reply in examples:
            item, created = OrganizationRequest.objects.get_or_create(public_id=example_id(key), defaults={
                "organization": organization, "created_by": partner, "title": title, "category": category,
                "body": body, "project_id": example_id(project), "status": status, "is_test": True,
                "policy_version": "synthetic-test", "consented_at": now,
            })
            if created:
                StaffAssignment.objects.create(org_request=item, team=fund, assignee=coordinator, next_step=step)
                OrganizationEvent.objects.create(organization=organization, request=item, actor=partner,
                                                 event_type="created", detail={"test": True})
                OrganizationRequestMessage.objects.create(request=item, author=coordinator, body=reply, is_staff_reply=True)
            items.append(item)
        return items
