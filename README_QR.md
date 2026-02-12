# 📱 Votación Digital con Códigos QR

## 🎉 Nuevas Funcionalidades Agregadas

Se han agregado **códigos QR** a la aplicación de votación para facilitar el proceso de identificación de los estudiantes. Ahora los estudiantes pueden votar de **3 formas diferentes**:

### Métodos de Votación

1. **✍️ Ingresar código manualmente** (método original)
   - El estudiante escribe su código de 5 dígitos
   - Presiona "Verificar" y continúa con la votación

2. **📱 Escanear código QR del carnet**
   - Escanea el código QR con la cámara de su celular
   - Se abre automáticamente la página de votación con el código pre-cargado
   - Solo debe confirmar y votar

3. **📷 Escanear QR con la cámara del dispositivo**
   - En la página de votación, hace clic en "Escanear QR"
   - Usa la cámara para escanear su código QR del carnet
   - El código se ingresa automáticamente

---

## 🎴 Carnets Electorales con QR Integrado

**¡IMPORTANTE!** Los carnets electorales ahora incluyen **ambas opciones** en un solo documento:

✅ **Código numérico** visible (5 dígitos)  
✅ **Código QR** escaneable  

Esto significa que:
- Solo necesitas imprimir **UN carnet por estudiante**
- El estudiante puede elegir usar el código o el QR
- No necesitas imprimir códigos QR por separado
- Todo está en el mismo carnet electoral

---

## 📋 Archivos Modificados y Nuevos

### Nuevos Archivos

1. **`generar-qr.html`** - Generador de códigos QR independientes (opcional)
   - Genera códigos QR por separado si los necesitas
   - Útil si quieres distribuir solo QR sin carnets completos
   - Se accede desde el panel de administración → "Códigos QR"

### Archivos Modificados

1. **`admin.html`** - Panel de administración
   - ✅ Los carnets ahora incluyen QR automáticamente
   - ✅ Nueva sección "Códigos QR" (opcional, para QR independientes)
   - ✅ Instrucciones actualizadas

2. **`index.html`** - Página de votación
   - ✅ Agregado botón "Escanear QR" 
   - ✅ Modal con escáner QR usando la cámara
   - ✅ Detección automática de código cuando se escanea un QR
   - ✅ Librería html5-qrcode para escaneo

---

## 🚀 Cómo Usar (Flujo Recomendado)

### Para Administradores

1. **Accede al Panel de Administración**
   - Ingresa a `admin.html`
   - Usa tu código de administrador

2. **Ve a la sección "Carnets"**
   - En el menú superior, haz clic en "Carnets"

3. **Genera los carnets con QR integrado**
   - Los carnets se generarán automáticamente con:
     - Logo del colegio
     - Información del estudiante
     - Código numérico
     - **Código QR** (nuevo)
   - Puedes filtrar por grado, curso o estado

4. **Imprime los carnets**
   - Haz clic en "🖨️ Imprimir Carnets"
   - Se imprimirán en formato 2 columnas
   - Corta y distribuye a cada estudiante su carnet

### Para Estudiantes

#### Opción 1: Escanear el QR del carnet con el celular
1. Abre la cámara del celular
2. Escanea el código QR de tu carnet
3. Se abrirá automáticamente la página de votación
4. Tu código ya estará cargado
5. Verifica tu información y vota

#### Opción 2: Usar el botón "Escanear QR"
1. Abre la página de votación en cualquier dispositivo
2. Haz clic en "📱 Escanear QR"
3. Permite el acceso a la cámara
4. Apunta la cámara al QR de tu carnet
5. El código se detectará automáticamente
6. Verifica tu información y vota

#### Opción 3: Ingresar código manualmente
1. Abre la página de votación
2. Escribe tu código de 5 dígitos (está en el carnet)
3. Haz clic en "Verificar"
4. Vota normalmente

---

## ❓ Preguntas Frecuentes

### ¿Necesito usar la página "Generar QR" aparte?
**No.** Los carnets electorales ya incluyen el QR. La página `generar-qr.html` es opcional y solo útil si quieres:
- Códigos QR sin carnets completos
- Solo QR para distribuir digitalmente
- Formato más grande de QR para imprimir separado

### ¿Qué diferencia hay entre Carnets y Códigos QR?
- **Carnets**: Documento completo con logo, datos, código numérico Y código QR (recomendado)
- **Códigos QR**: Solo el QR con datos mínimos (uso opcional/alternativo)

### ¿Puedo usar ambos?
Sí, pero normalmente solo necesitas los **Carnets** que ya incluyen todo.

---

## 🔧 Detalles Técnicos

### Librerías Utilizadas

- **qrcode.js** (v1.5.3) - Para generar códigos QR en carnets y en `generar-qr.html`
- **html5-qrcode** (v2.3.8) - Para escanear códigos QR con la cámara en `index.html`

### Formato de los Códigos QR

Cada código QR contiene una URL con el siguiente formato:
```
https://tu-dominio.com/index.html?code=12345
```

Donde `12345` es el código único del estudiante.

### Ventajas de los Códigos QR en Carnets

✅ **Todo en uno**: Código y QR en el mismo documento  
✅ **Más rápido**: Escanear es más rápido que escribir  
✅ **Sin errores**: Elimina errores de tipeo  
✅ **Flexible**: El estudiante elige cómo votar  
✅ **Profesional**: Carnets completos y modernos  

---

## 📱 Requisitos

### Para Escanear QR con la Cámara
- Navegador moderno (Chrome, Safari, Firefox, Edge)
- Permiso de acceso a la cámara
- Conexión HTTPS (o localhost para pruebas)

### Para Escanear QR del Carnet
- Cualquier celular con cámara
- App de cámara nativa o lector QR

---

## 🎨 Diseño de Carnets

Los carnets incluyen:
- Logo del colegio (parte superior)
- Nombre del estudiante
- Grado y curso
- Número de lista
- **Código numérico** (grande, destacado)
- **Código QR** (centro, fácil de escanear)
- Texto: "Escanea el QR o usa el código"

---

## 🔐 Seguridad

- Los códigos QR no comprometen la seguridad
- Cada código QR solo contiene el código del estudiante
- La validación se hace en el servidor (igual que antes)
- No se puede votar múltiples veces con el mismo código
- El QR y el código llevan al mismo proceso de verificación

---

## 📞 Soporte

Si tienes preguntas o problemas:
1. Verifica que los estudiantes estén cargados en el sistema
2. Asegúrate de tener conexión a internet
3. Revisa que la cámara tenga permisos
4. Usa HTTPS en producción (no HTTP)
5. Los carnets se generan automáticamente con QR, no necesitas hacer nada extra

---

## ✨ Resumen de Cambios

### Lo que se agregó:
- ✅ **Códigos QR integrados en los carnets electorales** (principal novedad)
- ✅ Página generadora de códigos QR independientes (`generar-qr.html`) - opcional
- ✅ Botón "Escanear QR" en la página de votación
- ✅ Modal con escáner de QR usando la cámara
- ✅ Detección automática de código desde URL (QR escaneado)
- ✅ Sección "Códigos QR" en el panel de administración (opcional)

### Lo que NO cambió:
- ✅ Toda la funcionalidad original sigue igual
- ✅ Se puede seguir votando con código manual
- ✅ La base de datos no cambió
- ✅ El proceso de verificación es el mismo
- ✅ Compatible con la versión anterior

### Recomendación de uso:
🎯 **Usa la sección "Carnets"** del panel de administración - ya incluye todo lo que necesitas (código + QR)

---

¡Listo para usar! 🎉
