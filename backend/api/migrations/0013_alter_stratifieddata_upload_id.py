# Generated by Django 5.1.1 on 2024-11-07 04:24

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_alter_stratifieddata_upload_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stratifieddata',
            name='upload_id',
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
    ]
