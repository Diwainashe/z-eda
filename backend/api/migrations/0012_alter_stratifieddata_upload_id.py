# Generated by Django 5.1.1 on 2024-11-07 04:24

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_remove_stratifieddata_upload_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stratifieddata',
            name='upload_id',
            field=models.UUIDField(editable=False, unique=True),
        ),
    ]
