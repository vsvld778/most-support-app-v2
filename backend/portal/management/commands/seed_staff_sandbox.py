import secrets

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from portal.models import Organization, OrganizationMembership, SupportCase, User
from portal.organization_models import OrganizationRequest
from portal.staff_models import StaffAssignment, StaffMembership, StaffTeam


class Command(BaseCommand):
    help = "Create synthetic accounts and records only in the isolated staff sandbox."

    @transaction.atomic
    def handle(self, *args, **kwargs):
        if not getattr(settings, "STAFF_SANDBOX", False):
            raise CommandError("This command requires the isolated staff sandbox.")
        people, credentials = {}, []
        for role, name in (("coordinator", "Координатор центра"), ("specialist", "Специалист Института"),
                           ("migrant", "Заявитель Азиз"), ("partner", "Представитель партнёра")):
            email = f"{role}@most.example"
            if User.objects.filter(email=email).exists():
                raise CommandError("Sandbox accounts already exist. Passwords were preserved.")
            password = secrets.token_urlsafe(18)
            people[role] = User.objects.create_user(email=email, display_name=name, password=password)
            credentials.append((email, password))
        fund = StaffTeam.objects.get(slug="fund")
        institute = StaffTeam.objects.get(slug="institute")
        StaffMembership.objects.create(team=fund, user=people["coordinator"], role=StaffMembership.Role.LEAD)
        StaffMembership.objects.create(team=institute, user=people["specialist"], role=StaffMembership.Role.SPECIALIST)
        partner = Organization.objects.create(name="Учебный центр адаптации", kind=Organization.Kind.NGO, is_approved=True)
        OrganizationMembership.objects.create(user=people["partner"], organization=partner, role=OrganizationMembership.Role.MANAGER)
        case = SupportCase.objects.create(owner=people["migrant"], title="Уточнить расчёт оплаты за смены",
            category=SupportCase.Category.EMPLOYMENT, description="Вымышленный пример. Нужно уточнить расчёт за три смены.",
            city="Москва", preferred_language="ru", is_test=True)
        StaffAssignment.objects.create(case=case, team=fund, assignee=people["coordinator"])
        specialist_case = SupportCase.objects.create(owner=people["migrant"], title="Проверить условия в образце договора",
            category=SupportCase.Category.EMPLOYMENT, description="Вымышленный пример. В договоре нужно уточнить график и условия оплаты.",
            city="Москва", preferred_language="ru", is_test=True)
        StaffAssignment.objects.create(case=specialist_case, team=institute, assignee=people["specialist"])
        item = OrganizationRequest.objects.create(organization=partner, created_by=people["partner"],
            title="Согласовать встречу по адаптации", category=OrganizationRequest.Category.ADAPTATION,
            body="Вымышленный пример. Предлагаем согласовать план встречи.", is_test=True)
        StaffAssignment.objects.create(org_request=item, team=fund, assignee=people["coordinator"])
        for email, password in credentials:
            self.stdout.write(f"{email} {password}")
