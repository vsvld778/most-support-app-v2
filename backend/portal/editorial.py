from django.db import models

SITE = {
    "home": "Главная", "help": "Нужна помощь", "guides": "Памятки", "about": "О программе",
    "partners": "Партнёрам", "employers": "Работодателям", "staffing": "Кадровым компаниям",
    "prearrival": "До приезда", "contacts": "Контакты", "request": "Подготовка обращения",
    "cooperate": "Сотрудничество",
}
PERSONAL = {
    "entry": "Выбор кабинета", "login": "Вход", "signup": "Регистрация",
    "cases": "Мои обращения", "case-new": "Новое обращение", "case": "Карточка обращения",
}
ORGANIZATION = {
    "overview": "Обзор", "requests": "Заявки", "messages": "Сообщения", "projects": "Проекты",
    "services": "Услуги", "documents": "Документы", "organization": "Профиль организации",
    "reports": "Отчёты", "more": "Все разделы", "request": "Карточка заявки",
}
APPLICATION = {"home": "Главная", "services": "Все сервисы", "profile": "Профиль"}
SURFACES = {"site": SITE, "personal": PERSONAL, "organization": ORGANIZATION, "application": APPLICATION}
LANGUAGES = {"ru", "en", "tg", "uz", "kk", "ky", "be", "hi"}


class EditorialPage(models.Model):
    surface = models.CharField(max_length=16)
    page = models.CharField(max_length=128)
    version = models.PositiveIntegerField(default=0)
    published_version = models.PositiveIntegerField(default=0)
    draft = models.JSONField(default=list)
    published = models.JSONField(default=list)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("surface", "page"), name="editorial_surface_page")]


class EditorialImage(models.Model):
    key = models.UUIDField(primary_key=True, editable=False)
    data = models.BinaryField()
    released = models.BooleanField(default=False)
