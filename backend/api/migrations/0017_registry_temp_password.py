# Generated by Django 5.1.1 on 2024-11-07 11:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_registry'),
    ]

    operations = [
        migrations.AddField(
            model_name='registry',
            name='temp_password',
            field=models.CharField(blank=True, max_length=128, null=True),
        ),
    ]
