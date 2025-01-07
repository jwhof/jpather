from django.db import models

class Path(models.Model):
    name = models.CharField(max_length=100)
    coordinates = models.TextField()

    def __str__(self):
        return self.name
