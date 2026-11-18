# Flujo del repositorio del TP

El repositorio ya existe en https://github.com/GonzaloAPU/tp-Final-Gymbro. main está protegida; develop es la rama de integración. No ejecutar git init ni crear un historial independiente.

## Cada compañero

```powershell
git clone https://github.com/GonzaloAPU/tp-Final-Gymbro.git
cd tp-Final-Gymbro
git switch develop
git switch -c feature/aldo
```

Usar feature/aldo, feature/facundo, feature/sonia o feature/rodrigo según el integrante. Todas parten de develop. La aplicación base está incorporada: agregar el trabajo propio, revisar git diff, probar, hacer commit y push de la feature. Abrir PR a develop y actualizarla antes de continuar. Gonzalo revisa la integración y propone develop → main cuando esté validada.

No subir .env, node_modules, compilaciones, logs ni datos reales. main exige PR y una aprobación incluso para administradores. No hacer force push. La configuración de GHCR con GITHUB_TOKEN está en CONFIGURACION-GITHUB.md; la implementación del pipeline corresponde a Aldo.
