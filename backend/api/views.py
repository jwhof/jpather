from rest_framework import viewsets
from .models import Path
from .serializers import PathSerializer

class PathViewSet(viewsets.ModelViewSet):
    queryset = Path.objects.all()
    serializer_class = PathSerializer
