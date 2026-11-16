from django.contrib import admin, messages
from django.db import transaction
from django.shortcuts import redirect
from django.urls import reverse
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
    list_display = ("__str__", "mode")
    list_filter = ("mode",)
    readonly_fields = ("key",)
    autocomplete_fields = ("pilot_users", "pilot_organizations")
    change_form_template = "admin/platform/module_form.html"

    def response_change(self, request, obj):
        response = super().response_change(request, obj)
        if "_save" in request.POST and "_popup" not in request.POST:
            name = "application" if obj.key.startswith("personal.") or obj.key == "intake.personal" else "cabinets"
            response["Location"] = reverse(f"admin:platform_{name}")
        return response

    def has_add_permission(self, request):
        return False


class ContentBlockForm(forms.ModelForm):
    class Meta:
        model = ContentBlock
        fields = ("title", "text", "visible")
        widgets = {"text": forms.Textarea(attrs={"rows": 6})}


@admin.register(ContentBlock)
class ContentBlockAdmin(OwnerAdmin):
    list_display = ("target", "publication")
    form = ContentBlockForm
    actions = ("publish",)
    change_form_template = "admin/platform/content_form.html"

    def render_change_form(self, request, context, add=False, change=False, form_url="", obj=None):
        if obj is not None:
            context.update(
                editor_section="site" if obj.target == "site" else "cabinets",
                published_revision=obj.revisions.first(),
            )
        return super().render_change_form(request, context, add, change, form_url, obj)

    def response_change(self, request, obj):
        if "_publish" in request.POST and "_popup" not in request.POST:
            self.publish(request, self.get_queryset(request).filter(pk=obj.pk))
            return redirect("admin:portal_contentblock_change", obj.pk)
        return super().response_change(request, obj)

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
