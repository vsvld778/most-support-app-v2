from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


FEATURES = [
    ("personal.plan", "Мой план"), ("personal.documents", "Документы и сроки"),
    ("personal.help", "Черновики обращений"), ("personal.nearby", "Помощь рядом"),
    ("personal.offline", "Офлайн-памятка"), ("personal.work", "Работа и выплаты"),
    ("personal.offers", "Сравнение работы"), ("personal.contract", "Перед подписью"),
    ("personal.skills", "Навыки и опыт"), ("personal.family", "Моя семья"),
    ("personal.housing", "Жильё и залог"), ("personal.learning", "Русский для жизни"),
    ("personal.journey", "Маршрут переезда"), ("personal.voice", "Голосовые черновики"),
    ("personal.safety", "Проверка предложения"), ("personal.aid", "Подготовка заявки на поддержку"),
    ("organization.projects", "Проекты"), ("organization.services", "Услуги"),
    ("organization.documents", "Документы"), ("organization.reports", "Отчёты"),
    ("intake.personal", "Обращения мигрантов в фонд"), ("intake.organization", "Заявки организаций в фонд"),
]
TARGETS = [("site", "Основной сайт"), ("personal", "Кабинет мигранта"), ("organization", "Кабинет организации")]
PILOT_BASELINE = {key for key, _ in FEATURES[:5]} | {"organization.projects", "intake.personal", "intake.organization"}


def seed_controls(apps, schema_editor):
    FeatureSetting = apps.get_model("portal", "FeatureSetting")
    ContentBlock = apps.get_model("portal", "ContentBlock")
    db = schema_editor.connection.alias
    for key, _ in FEATURES:
        FeatureSetting.objects.using(db).get_or_create(key=key, defaults={"mode": "on" if key in PILOT_BASELINE else "off"})
    for target, _ in TARGETS:
        ContentBlock.objects.using(db).get_or_create(target=target)


class Migration(migrations.Migration):
    dependencies = [("portal", "0003_merge_workspaces")]
    operations = [
        migrations.CreateModel(
            name="FeatureSetting",
            fields=[
                ("key", models.CharField(choices=FEATURES, max_length=48, primary_key=True, serialize=False, verbose_name="Функция")),
                ("mode", models.CharField(choices=[("off", "Выключен"), ("read", "Только просмотр"),
                    ("pause", "Приостановить новые заявки"), ("pilot", "Пилот"), ("on", "Работает")], default="off", max_length=8, verbose_name="Режим")),
                ("pilot_users", models.ManyToManyField(blank=True, to=settings.AUTH_USER_MODEL, verbose_name="Участники пилота")),
                ("pilot_organizations", models.ManyToManyField(blank=True, to="portal.organization", verbose_name="Организации пилота")),
            ],
            options={"verbose_name": "настройка модуля", "verbose_name_plural": "Настройки модулей"},
        ),
        migrations.CreateModel(
            name="ContentBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("target", models.CharField(choices=TARGETS, max_length=16, unique=True, verbose_name="Где показать")),
                ("title", models.CharField(blank=True, max_length=120, verbose_name="Заголовок черновика")),
                ("text", models.CharField(blank=True, max_length=1200, verbose_name="Текст черновика")),
                ("visible", models.BooleanField(default=False, verbose_name="Показывать при публикации")),
            ],
            options={"verbose_name": "редактируемый блок", "verbose_name_plural": "Содержимое сайта и кабинетов"},
        ),
        migrations.CreateModel(
            name="ContentRevision",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, max_length=120)),
                ("text", models.CharField(blank=True, max_length=1200)),
                ("visible", models.BooleanField(default=False)),
                ("published_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("block", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="revisions", to="portal.contentblock")),
            ],
            options={"ordering": ["-pk"], "verbose_name": "версия публикации", "verbose_name_plural": "Версии публикаций"},
        ),
        migrations.RunPython(seed_controls, migrations.RunPython.noop),
    ]
