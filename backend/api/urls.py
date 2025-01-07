from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PathViewSet

router = DefaultRouter()
router.register(r'paths', PathViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
