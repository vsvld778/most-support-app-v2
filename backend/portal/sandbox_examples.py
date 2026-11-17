from datetime import timedelta
from urllib.parse import urljoin
from uuid import NAMESPACE_URL, uuid5

from django.conf import settings
from django.utils import timezone


def example_id(key):
    return str(uuid5(NAMESPACE_URL, "migrantmost.ru/staff-test/examples/2026-11/" + key))


def personal_examples():
    today = timezone.localdate()

    def day(offset):
        return (today + timedelta(days=offset)).isoformat()

    def task(key, title, date, detail, done=False):
        return {
            "id": example_id(key), "title": title, "date": date, "detail": detail,
            "done": done, "source": "Учебный пример", "created": day(0),
        }

    return {
        "version": 2,
        "profile": {"name": "Азиз (учебный профиль)", "region": "Москва", "country": "Кыргызстан", "language": "ru"},
        "preferences": {},
        "modules": {
            "plan": {"tasks": [
                task("collect-shifts", "Собрать записи о сменах", day(-2), "Три смены и одна полученная выплата.", True),
                task("consultation-task", "Выбрать время учебной консультации", day(2), "Фонд попросил выбрать утро или вечер."),
                task("document-task", "Уточнить дату по учебному документу", day(7), "Личная дата для напоминания."),
            ]},
            "documents": {"items": [
                {"id": example_id("contract-document"), "name": "Образец трудового договора", "date": day(7),
                 "note": "Учебная запись. Уточнить график, размер и даты выплаты.", "files": [], "created": day(0)},
                {"id": example_id("rental-document"), "name": "Образец расписки о залоге", "date": day(11),
                 "note": "Уточнить условия возврата при выезде.", "files": [], "created": day(0)},
            ]},
            "help": {"cases": [{
                "id": example_id("rent-draft"), "title": "Уточнить порядок возврата залога",
                "topic": "Жильё", "text": "Черновик учебного вопроса. Какие условия возврата стоит записать в расписке?",
                "created": day(0), "updated": day(0), "status": "draft", "files": [],
                "events": [], "shareLog": [], "owner": "", "nextStep": "Сверить вопросы с образцом расписки.", "due": day(4),
            }]},
            "nearby": {"appointments": [{
                "id": example_id("visit"), "organization": "Учебный центр адаптации",
                "purpose": "Подготовиться к первой консультации", "date": day(3), "time": "18:00",
                "status": "planned", "confirmation": "", "note": "Личный план Азиза. Время предстоит согласовать.",
            }]},
            "offline": {
                "card": {"name": "Азиз", "language": "Кыргызский, русский", "contact": "Доверенный учебный контакт",
                         "notes": "Мне удобнее получить время и адрес встречи в письменном виде."},
                "contacts": [{"id": example_id("offline-contact"), "name": "Учебный центр адаптации", "phone": "",
                              "address": "Учебная встреча в Москве", "notes": "Уточнить место через фонд."}],
            },
            "work": {
                "records": [
                    {"id": example_id(f"shift-{offset}"), "type": "shift", "date": day(offset),
                     "note": "Учебная смена", "hours": hours, "rate": 400}
                    for offset, hours in ((-5, 8), (-4, 7), (-3, 8))
                ] + [{"id": example_id("payment"), "type": "payment", "date": day(-2),
                      "note": "Частичная учебная выплата", "amount": 6000}],
                "dossier": {"title": "Уточнить расчёт оплаты за смены", "from": day(-5), "to": day(-2),
                            "note": "Учебный расчёт по 23 часам. Сверить с записью «Уточнить расчёт оплаты за смены».", "files": []},
            },
            "offers": {"entries": [
                {"id": example_id("offer-" + str(index)), "title": title, "mode": "monthly", "salary": salary,
                 "rate": 0, "hours": 8, "days": 22, "rent": rent, "transport": transport, "food": 10000,
                 "other": 2500, "note": "Вымышленное предложение для сравнения расходов."}
                for index, (title, salary, rent, transport) in enumerate((
                    ("Комплектовщик · учебный пример", 74000, 21000, 3500),
                    ("Помощник в мастерской · учебный пример", 69000, 17000, 1900),
                ), start=1)
            ]},
            "contract": {"records": [{
                "id": example_id("contract-analysis"), "title": "Разбор образца трудового договора", "created": day(0),
                "source": "Учебный фрагмент. Смены по 8 часов. Оплата почасовая. Даты выплаты уточняются.",
                "answers": {"salary": "Указана почасовая оплата, без дат.", "schedule": "Смены по 8 часов.",
                            "deductions": "", "housing": "", "ending": "", "parties": ""},
                "report": {"hits": [{"label": "Рабочее время", "question": "Как учитываются часы, перерывы и дополнительные смены?"}],
                           "missing": ["Удержания и дополнительные расходы", "Жильё и условия проживания",
                                       "Изменение и прекращение договора", "Стороны, даты и подписи"]},
                "extra": "Спросить, где указаны размер ставки и даты оплаты.", "files": [],
            }]},
            "skills": {"items": [{
                "id": example_id("skill"), "title": "Приём и учёт товара", "type": "Навык",
                "organisation": "Учебная мастерская", "date": day(-12), "detail": "Сверять позиции по накладной.", "attachment": None,
            }]},
            "family": {"members": [{
                "id": example_id("family-member"), "name": "Близкий человек", "role": "Взрослый",
                "note": "Договорились созвониться после встречи.",
                "tasks": [{"id": example_id("family-task"), "title": "Запланировать созвон", "date": day(4), "done": False}],
            }]},
            "housing": {
                "lease": {"address": "Учебная комната в Москве", "landlord": "Учебный контакт", "moveDate": day(-9),
                          "rent": 18000, "depositPaid": 10000, "depositReturned": 0, "payDay": 15,
                          "note": "Сверить условия возврата по образцу расписки."},
                "checks": {"terms": True, "condition": True},
                "inventory": [{"id": example_id("housing-inventory"), "title": "Ключи при заселении", "date": day(-9),
                               "note": "Получены два комплекта. Учебная запись."}],
                "files": [],
            },
            "learning": {"learned": ["work1", "work3", "care1"]},
            "journey": {"origin": "Кыргызстан", "region": "Москва", "arrival": day(-10),
                        "goal": "Разобраться с оплатой смен и подготовиться к консультации.",
                        "questions": "Какие сведения подготовить к первой встрече?", "done": ["purpose", "budget", "address", "plan"]},
            "voice": {"draft": {"title": "Рассказ о трёх сменах", "language": "ky", "topic": "Работа и зарплата",
                                "text": "Учебный текст: я хочу показать записи о сменах и уточнить, как посчитали выплату."}},
            "safety": {"records": [{
                "id": example_id("safety-check"), "title": "Учебное объявление с предоплатой", "created": day(0),
                "source": "Для доступа к вакансии требуется предоплата.", "checked": [],
                "hits": [{"id": "advance", "title": "Деньги до понятных условий",
                          "question": "Кому, за что и на основании какого документа предлагают заплатить?"}],
                "notes": "Попросить письменные условия и уточнить, кто размещает объявление.",
            }]},
            "aid": {"requests": [{
                "id": example_id("aid-draft"), "type": "Юридическая консультация",
                "reason": "Подготовить вопросы о графике и порядке выплаты.", "region": "Москва",
                "date": day(5), "tried": "Собрал записи о сменах и просмотрел образец договора.",
                "closed": False, "created": day(0),
            }]},
        },
    }


def organization_examples():
    today = timezone.localdate()
    project_id = example_id("consultation-project")
    return {
        "profile": {"city": "Москва", "website": "",
                    "description": "Учебная команда ведёт консультации и разговорные занятия.",
                    "languages": ["ru", "ky", "uz"]},
        "projects": [
            {"id": project_id, "title": "Первая консультация", "status": "active",
             "description": "Подготовить список вопросов и согласовать время вводной встречи.",
             "deadline": (today + timedelta(days=7)).isoformat()},
            {"id": example_id("language-project"), "title": "Разговорный клуб для новичков",
             "status": "completed", "description": "Учебная встреча по языковым ситуациям на работе.",
             "deadline": (today - timedelta(days=5)).isoformat()},
        ],
        "services": [
            {"id": example_id("consultation-service"), "title": "Подготовка к первой консультации",
             "description": "Объяснить порядок встречи и помочь сформулировать вопросы.", "category": "adaptation", "available": True},
            {"id": example_id("language-service"), "title": "Разговорная практика",
             "description": "Разобрать фразы о графике, сроках и записи на приём.", "category": "event", "available": True},
        ],
        "documents": [{
            "id": example_id("checklist"), "title": "Памятка перед первой консультацией", "category": "template",
            "url": urljoin(settings.PUBLIC_SITE_URL, settings.STATIC_URL + "organization/examples/consultation-checklist.txt"),
            "note": "Вымышленный образец, привязанный к проекту «Первая консультация».", "projectId": project_id,
        }],
    }
