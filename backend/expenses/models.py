# expenses/models.py
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings

class Expense(models.Model):
    """
    Track operational expenses: delivery, transport, labor, etc.
    """
    type = models.CharField(max_length=50, help_text=_("Expense category or type"))
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text=_("Amount spent"))
    description = models.TextField(blank=True, help_text=_("Optional details"))
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="expenses_paid",
        help_text=_("User who paid this expense")
    )
    date = models.DateField(help_text=_("Date of the expense"))
    is_deleted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = _('expense')
        verbose_name_plural = _('expenses')

    def __str__(self):
        return f"{self.type}: {self.amount} on {self.date}"
