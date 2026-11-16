from django.contrib import admin, messages
from django.db import transaction
from django import forms

from .platform_controls import ContentBlock, ContentRevision, FeatureSetting


class OwnerAdmin(admin.ModelAdmin):
    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False


class FeatureSettingForm(forms.ModelForm):
    class Meta:
        model = FeatureSetting
        fields = ("mode", "pilot_users", "pilot_organizations")

    def clean_mode(self):
        mode = self.cleaned_data["mode"]
        if mode == FeatureSetting.Mode.PAUSE and not self.instance.key.startswith("intake."):
            raise forms.ValidationError("Приостановка новых заявок доступна только для разделов приёма.")
        return mode


@admin.register(FeatureSetting)
class FeatureSettingAdmin(OwnerAdmin):
    form = FeatureSettingForm
    list_display = ("key", "mode")
    list_filter = ("mode",)
    readonly_fields = ("key",)
    autocomplete_fields = ("pilot_users", "pilot_organizations")

    def has_add_permission(self, request):
        return False


@admin.register(ContentBlock)
class ContentBlockAdmin(OwnerAdmin):
    list_display = ("target", "publication")
    readonly_fields = ("target", "publication")
    actions = ("publish",)

    def has_add_permission(self, request):
        return False

    @admin.display(description="Опубликованная версия")
    def publication(self, block):
        latest = block.revisions.first()
        return latest.published_at if latest else "Ещё не опубликован"

    @admin.action(permissions=["change"], description="Опубликовать выбранные черновики")
    def publish(self, request, queryset):
        count = 0
        with transaction.atomic():
            for block in queryset.select_for_update():
                ContentRevision.objects.create(block=block, author=request.user, title=block.title,
                                               text=block.text, visible=block.visible)
                self.log_change(request, block, "Опубликован черновик.")
                count += 1
        self.message_user(request, f"Опубликовано блоков: {count}.", messages.SUCCESS)


@admin.register(ContentRevision)
class ContentRevisionAdmin(OwnerAdmin):
    list_display = ("block", "published_at", "author", "visible")
    list_filter = ("block", "visible")
    readonly_fields = ("block", "published_at", "author", "title", "text", "visible")
    actions = ("restore_draft",)

    def has_add_permission(self, request):
        return False

    @admin.action(permissions=["change"], description="Восстановить выбранную версию в черновик")
    def restore_draft(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Выберите одну версию.", messages.ERROR)
            return
        version = queryset.get()
        ContentBlock.objects.filter(pk=version.block_id).update(title=version.title, text=version.text,
                                                                 visible=version.visible)
        self.log_change(request, version, "Версия скопирована в черновик.")
        self.message_user(request, "Черновик восстановлен. Проверьте и опубликуйте его.", messages.SUCCESS)
