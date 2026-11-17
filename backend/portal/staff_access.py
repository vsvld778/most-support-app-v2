from django.db.models import Q

from .staff_models import INTAKE_TEAM, StaffMembership, StaffTeam


def memberships(user):
    if not user.is_authenticated or not user.is_active:
        return StaffMembership.objects.none()
    return StaffMembership.objects.filter(user=user, active=True)


def has_desk(user):
    return user.is_authenticated and user.is_active and (user.is_superuser or memberships(user).exists())


def scope(queryset, user):
    if user.is_superuser and user.is_active:
        return queryset
    roles = memberships(user)
    staff = roles.exclude(role=StaffMembership.Role.SPECIALIST)
    specialists = roles.filter(role=StaffMembership.Role.SPECIALIST)
    access = Q(staff_assignment__team__in=staff.values("team")) | Q(
        staff_assignment__team__in=specialists.values("team"), staff_assignment__assignee=user,
    )
    if staff.filter(team__slug=INTAKE_TEAM).exists():
        access |= Q(staff_assignment__isnull=True)
    return queryset.filter(access)


def team_role(user, record):
    if user.is_superuser:
        return StaffMembership.Role.LEAD
    role = memberships(user)
    assignment = getattr(record, "staff_assignment", None)
    role = role.filter(team_id=assignment.team_id) if assignment else role.filter(team__slug=INTAKE_TEAM)
    return role.values_list("role", flat=True).first()


def assignable_teams(user, record):
    if team_role(user, record) == StaffMembership.Role.LEAD:
        return StaffTeam.objects.all()
    assignment = getattr(record, "staff_assignment", None)
    return StaffTeam.objects.filter(pk=assignment.team_id) if assignment else StaffTeam.objects.filter(slug=INTAKE_TEAM)
