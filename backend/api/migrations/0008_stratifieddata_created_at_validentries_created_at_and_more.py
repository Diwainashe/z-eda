# Generated by Django 5.1.1 on 2024-11-07 03:06

import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_alter_masterdata_unique_together'),
    ]

    operations = [
        migrations.AddField(
            model_name='stratifieddata',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AddField(
            model_name='validentries',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterField(
            model_name='dataupload',
            name='upload_id',
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
        migrations.AlterField(
            model_name='masterdata',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
        migrations.AlterField(
            model_name='uploadlog',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
    ]
