from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("portal", "0004_platform_controls")]
    operations = [
        migrations.CreateModel(
            name="EditorialPage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("surface", models.CharField(max_length=16)),
                ("page", models.CharField(max_length=128)),
                ("version", models.PositiveIntegerField(default=0)),
                ("published_version", models.PositiveIntegerField(default=0)),
                ("draft", models.JSONField(default=list)),
                ("published", models.JSONField(default=list)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("surface", "page"), name="editorial_surface_page")]},
        ),
        migrations.CreateModel(
            name="EditorialImage",
            fields=[
                ("key", models.UUIDField(editable=False, primary_key=True, serialize=False)),
                ("data", models.BinaryField()),
                ("released", models.BooleanField(default=False)),
            ],
        ),
    ]
