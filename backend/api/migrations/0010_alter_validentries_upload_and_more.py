# Generated by Django 5.1.1 on 2024-11-07 04:02

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_alter_masterdata_created_at_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='validentries',
            name='upload',
            field=models.JSONField(),
        ),
        migrations.AlterField(
            model_name='stratifieddata',
            name='upload',
            field=models.JSONField(),
        ),
        migrations.AlterField(
            model_name='uploadlog',
            name='upload',
            field=models.JSONField(),
        ),
        migrations.DeleteModel(
            name='DataUpload',
        ),
    ]
