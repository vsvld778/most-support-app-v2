from django.conf import settings
from django.db import models
from django.db.models import Q

INTAKE_TEAM = "fund"


class StaffTeam(models.Model):
    slug = models.SlugField(unique=True)
    name = models.CharField("Название команды", max_length=120)

    class Meta:
        ordering = ("name",)
        verbose_name = "служебная команда"
        verbose_name_plural = "служебные команды"

    def __str__(self):
        return self.name


class StaffMembership(models.Model):
    class Role(models.TextChoices):
        COORDINATOR = "coordinator", "Координатор"
        SPECIALIST = "specialist", "Специалист"
        LEAD = "lead", "Руководитель команды"

    team = models.ForeignKey(StaffTeam, on_delete=models.PROTECT, verbose_name="Команда")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, verbose_name="Сотрудник")
    role = models.CharField("Роль", max_length=16, choices=Role.choices)
    active = models.BooleanField("Доступ открыт", default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("team", "user"), name="staff_unique_membership")]
        verbose_name = "доступ сотрудника"
        verbose_name_plural = "доступы сотрудников"

    def __str__(self):
        return f"{self.user} · {self.team}"


class StaffAssignment(models.Model):
    case = models.OneToOneField("portal.SupportCase", on_delete=models.CASCADE, null=True, blank=True, related_name="staff_assignment")
    org_request = models.OneToOneField("portal.OrganizationRequest", on_delete=models.CASCADE, null=True, blank=True, related_name="staff_assignment")
    team = models.ForeignKey(StaffTeam, on_delete=models.PROTECT)
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True)
    next_step = models.CharField(max_length=1200, blank=True)
    due = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(
            condition=Q(case__isnull=False, org_request__isnull=True) | Q(case__isnull=True, org_request__isnull=False),
            name="staff_assignment_has_one_subject",
        )]


class StaffOrganizationNote(models.Model):
    request = models.ForeignKey("portal.OrganizationRequest", on_delete=models.CASCADE, related_name="staff_notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    body = models.TextField(max_length=4000)
    created_at = models.DateTimeField(auto_now_add=True)
