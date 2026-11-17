from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def add_center_teams(apps, schema_editor):
    teams = apps.get_model("portal", "StaffTeam").objects.using(schema_editor.connection.alias)
    teams.get_or_create(slug="fund", defaults={"name": "Приём фонда"})
    teams.get_or_create(slug="institute", defaults={"name": "Специалисты Института ЕАЭС"})


class Migration(migrations.Migration):
    dependencies = [("portal", "0005_editorial"), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="StaffTeam",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(unique=True)),
                ("name", models.CharField(max_length=120, verbose_name="Название команды")),
            ],
            options={"ordering": ("name",), "verbose_name": "служебная команда", "verbose_name_plural": "служебные команды"},
        ),
        migrations.CreateModel(
            name="StaffMembership",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("role", models.CharField(choices=[("coordinator", "Координатор"), ("specialist", "Специалист"),
                   ("lead", "Руководитель команды")], max_length=16, verbose_name="Роль")),
                ("active", models.BooleanField(default=True, verbose_name="Доступ открыт")),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="portal.staffteam", verbose_name="Команда")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL, verbose_name="Сотрудник")),
            ],
            options={"verbose_name": "доступ сотрудника", "verbose_name_plural": "доступы сотрудников",
                     "constraints": [models.UniqueConstraint(fields=("team", "user"), name="staff_unique_membership")]},
        ),
        migrations.CreateModel(
            name="StaffAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("next_step", models.CharField(blank=True, max_length=1200)),
                ("due", models.DateTimeField(blank=True, null=True)),
                ("assignee", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ("case", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="staff_assignment", to="portal.supportcase")),
                ("org_request", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="staff_assignment", to="portal.organizationrequest")),
                ("team", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="portal.staffteam")),
            ],
            options={"constraints": [models.CheckConstraint(
                condition=models.Q(models.Q(case__isnull=False, org_request__isnull=True),
                                   models.Q(case__isnull=True, org_request__isnull=False), _connector="OR"),
                name="staff_assignment_has_one_subject")]},
        ),
        migrations.CreateModel(
            name="StaffOrganizationNote",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("body", models.TextField(max_length=4000)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ("request", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff_notes", to="portal.organizationrequest")),
            ],
        ),
        migrations.RunPython(add_center_teams, migrations.RunPython.noop),
    ]
