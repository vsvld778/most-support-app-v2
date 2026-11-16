from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class PlatformMigrationTests(TransactionTestCase):
    initial = ("portal", "0001_initial")
    unified = ("portal", "0004_platform_controls")

    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_existing_v2_workspace_survives_upgrade(self):
        self.migrate(self.initial)
        try:
            apps = self.migrate(("portal", "0002_userworkspace_workspaceevent"))
            user = apps.get_model("portal", "User").objects.create(email="v2@example.test")
            workspace = apps.get_model("portal", "UserWorkspace").objects.create(
                owner_id=user.pk, revision=7, data={"modules": {"plan": {"tasks": [{"title": "Прежняя задача"}]}}})
            upgraded = self.migrate(self.unified)
            retained = upgraded.get_model("portal", "UserWorkspace").objects.get(pk=workspace.pk)
            self.assertEqual(retained.owner_id, user.pk)
            self.assertEqual(retained.revision, 7)
            self.assertEqual(retained.data, workspace.data)
            self.assertTrue(upgraded.get_model("portal", "FeatureSetting").objects.filter(pk="personal.plan").exists())
        finally:
            self.migrate(self.unified)

    def test_existing_organization_data_survives_upgrade(self):
        self.migrate(self.initial)
        try:
            apps = self.migrate(("portal", "0002_organization_workspace"))
            user = apps.get_model("portal", "User").objects.create(email="partner@example.test")
            organization = apps.get_model("portal", "Organization").objects.create(name="Учебная организация", is_approved=True)
            apps.get_model("portal", "OrganizationMembership").objects.create(
                user_id=user.pk, organization_id=organization.pk, role="manager")
            item = apps.get_model("portal", "OrganizationRequest").objects.create(
                organization_id=organization.pk, created_by_id=user.pk, title="Прежняя заявка", body="Проверка")
            upgraded = self.migrate(self.unified)
            self.assertTrue(upgraded.get_model("portal", "OrganizationMembership").objects.filter(
                user_id=user.pk, organization_id=organization.pk, role="manager").exists())
            self.assertTrue(upgraded.get_model("portal", "OrganizationRequest").objects.filter(
                pk=item.pk, public_id=item.public_id, organization_id=organization.pk).exists())
        finally:
            self.migrate(self.unified)
