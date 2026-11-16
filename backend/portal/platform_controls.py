"""Shared catalog and policy for the web workspaces."""
from django.conf import settings
from django.db import models

PERSONAL_SEEDS = {
    "plan": {"tasks": [], "sourceChecks": {}, "situation": "arrival", "filter": "all"},
    "documents": {"items": []},
    "help": {"cases": []},
    "nearby": {"appointments": [], "category": "all"},
    "offline": {"contacts": [], "card": {"name": "", "language": "", "contact": "", "notes": ""}},
    "work": {"records": [], "dossier": {"title": "", "from": "", "to": "", "note": "", "files": []}},
    "offers": {"entries": []},
    "contract": {"records": []},
    "skills": {"items": []},
    "family": {"members": []},
    "housing": {"lease": {"address": "", "landlord": "", "moveDate": "", "rent": 0, "depositPaid": 0,
                         "depositReturned": 0, "payDay": 1, "note": ""}, "checks": {}, "inventory": [], "files": []},
    "learning": {"learned": [], "category": "Все", "translation": "ky"},
    "journey": {"origin": "", "region": "", "arrival": "", "goal": "", "questions": "", "done": []},
    "voice": {"clips": [], "draft": {"title": "", "language": "ru", "topic": "Другая ситуация", "text": ""}},
    "safety": {"records": []},
    "aid": {"requests": []},
}
PERSONAL_LABELS = (
    "Мой план", "Документы и сроки", "Черновики обращений", "Помощь рядом", "Офлайн-памятка",
    "Работа и выплаты", "Сравнение работы", "Перед подписью", "Навыки и опыт", "Моя семья",
    "Жильё и залог", "Русский для жизни", "Маршрут переезда", "Голосовые черновики",
    "Проверка предложения", "Подготовка заявки на поддержку",
)
ORG_MODULES = {"projects": "Проекты", "services": "Услуги", "documents": "Документы", "reports": "Отчёты"}
FEATURES = dict(zip(("personal." + name for name in PERSONAL_SEEDS), PERSONAL_LABELS))
FEATURES.update({"organization." + key: label for key, label in ORG_MODULES.items()})
FEATURES.update({"intake.personal": "Обращения мигрантов в фонд", "intake.organization": "Заявки организаций в фонд"})
DEFAULT_ENABLED = {
    "personal.plan", "personal.documents", "personal.help", "personal.nearby", "personal.offline",
    "organization.projects", "intake.personal", "intake.organization",
}


class FeatureSetting(models.Model):
    class Mode(models.TextChoices):
        OFF = "off", "Выключен"
        READ = "read", "Только просмотр"
        PAUSE = "pause", "Приостановить новые заявки"
        PILOT = "pilot", "Пилот"
        ON = "on", "Работает"

    key = models.CharField("Функция", max_length=48, primary_key=True, choices=list(FEATURES.items()))
    mode = models.CharField("Режим", max_length=8, choices=Mode.choices, default=Mode.OFF)
    pilot_users = models.ManyToManyField(settings.AUTH_USER_MODEL, verbose_name="Участники пилота", blank=True)
    pilot_organizations = models.ManyToManyField("portal.Organization", verbose_name="Организации пилота", blank=True)

    class Meta:
        verbose_name = "настройка модуля"
        verbose_name_plural = "Настройки модулей"

    def __str__(self):
        return self.get_key_display()


class ContentBlock(models.Model):
    TARGETS = [("site", "Основной сайт"), ("personal", "Кабинет мигранта"), ("organization", "Кабинет организации")]
    target = models.CharField("Где показать", max_length=16, unique=True, choices=TARGETS)
    title = models.CharField("Заголовок черновика", max_length=120, blank=True)
    text = models.CharField("Текст черновика", max_length=1200, blank=True)
    visible = models.BooleanField("Показывать при публикации", default=False)

    class Meta:
        verbose_name = "редактируемый блок"
        verbose_name_plural = "Содержимое сайта и кабинетов"

    def __str__(self):
        return self.get_target_display()


class ContentRevision(models.Model):
    block = models.ForeignKey(ContentBlock, on_delete=models.PROTECT, related_name="revisions")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    title = models.CharField(max_length=120, blank=True)
    text = models.CharField(max_length=1200, blank=True)
    visible = models.BooleanField(default=False)
    published_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-pk"]
        verbose_name = "версия публикации"
        verbose_name_plural = "Версии публикаций"

    def __str__(self):
        return f"{self.block} · {self.pk}"


def feature_modes(user, organization=None):
    modes = {key: "on" if key in DEFAULT_ENABLED else "off" for key in FEATURES}
    settings_rows = FeatureSetting.objects.prefetch_related("pilot_users", "pilot_organizations")
    for row in settings_rows:
        if row.key not in FEATURES:
            continue
        if row.mode != FeatureSetting.Mode.PILOT:
            modes[row.key] = row.mode
            continue
        if row.key.startswith("organization.") or row.key == "intake.organization":
            allowed = organization is not None and any(org.pk == organization.pk for org in row.pilot_organizations.all())
        else:
            allowed = user.is_authenticated and any(item.pk == user.pk for item in row.pilot_users.all())
        modes[row.key] = "on" if allowed else "off"
    return modes


def published_content(target):
    item = ContentRevision.objects.filter(block__target=target).first()
    if item is None:
        return {"revision": 0, "visible": False, "title": "", "text": ""}
    return {"revision": item.pk, "visible": item.visible, "title": item.title if item.visible else "",
            "text": item.text if item.visible else ""}


def restrict_personal_changes(previous, proposed, modes):
    old = previous.get("modules")
    new = proposed.get("modules")
    old = old if isinstance(old, dict) else {}
    if "modules" in proposed and not isinstance(new, dict):
        return False
    new = new or {}
    return all(
        modes["personal." + name] == "on" or old.get(name, seed) == new.get(name, seed)
        for name, seed in PERSONAL_SEEDS.items()
    )
