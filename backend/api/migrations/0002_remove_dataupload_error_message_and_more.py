# Generated by Django 5.1.1 on 2024-10-06 17:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='dataupload',
            name='error_message',
        ),
        migrations.AlterField(
            model_name='dataupload',
            name='status',
            field=models.CharField(default='pending', max_length=20),
        ),
        migrations.AlterField(
            model_name='dataupload',
            name='step',
            field=models.CharField(max_length=100),
        ),
    ]
