# 🔧 Solución de Problemas - Códigos QR

## ❌ Problema: Los códigos QR no aparecen en los carnets

Si los códigos QR no se están generando en los carnets electorales, sigue estos pasos:

### 1️⃣ Verificar la Librería QRCode

**Paso 1:** Abre el archivo `prueba-qr.html` en tu navegador
- Este archivo está en la carpeta raíz del proyecto
- Si funciona aquí, la librería se carga correctamente

**Paso 2:** Haz clic en "Generar Código QR"
- ✅ Si aparece el QR → La librería funciona
- ❌ Si no aparece → Hay un problema de conexión o CDN

### 2️⃣ Verificar la Consola del Navegador

**Cómo abrir la consola:**
- Chrome/Edge: Presiona `F12` o `Ctrl+Shift+J`
- Firefox: Presiona `F12` o `Ctrl+Shift+K`
- Safari: `Cmd+Option+C`

**Qué buscar:**
- Errores en rojo sobre "QRCode"
- Errores de "CORS" o "net::ERR"
- Mensajes de "librería no cargada"

### 3️⃣ Soluciones Comunes

#### Solución A: Usar otra CDN

Si la CDN actual no funciona, cambia en `admin.html` la línea 8:

**Cambiar de:**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
```

**A una de estas alternativas:**

```html
<!-- Opción 1: unpkg -->
<script src="https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js"></script>

<!-- Opción 2: jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>

<!-- Opción 3: Librería davidshimjs -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.js"></script>
```

#### Solución B: Descargar la librería localmente

Si ninguna CDN funciona (problemas de red/firewall):

1. Descarga `qrcode.min.js` desde: https://github.com/davidshimjs/qrcodejs
2. Guárdalo en la carpeta `public/`
3. Cambia la referencia en `admin.html`:
```html
<script src="qrcode.min.js"></script>
```

#### Solución C: Verificar conexión HTTPS

La librería QRCode requiere HTTPS en producción:
- ✅ En localhost funciona con HTTP
- ❌ En servidor remoto necesita HTTPS

### 4️⃣ Alternativa: Usar solo la página independiente

Si los carnets no generan QR pero necesitas QR urgentemente:

1. Ve a la sección **"Códigos QR"** en el admin
2. Haz clic en **"Abrir Generador de Códigos QR"**
3. Esta página (`generar-qr.html`) usa una librería diferente
4. Imprime estos QR y distribúyelos

### 5️⃣ Verificación Paso a Paso

**Test 1: Archivo de prueba**
```
✅ prueba-qr.html → QR aparece = Librería funciona
❌ prueba-qr.html → QR no aparece = Problema de librería/CDN
```

**Test 2: generar-qr.html**
```
✅ generar-qr.html → QR aparece = Esa librería funciona
❌ generar-qr.html → QR no aparece = Problema general
```

**Test 3: admin.html - Carnets**
```
✅ Carnets → QR aparece = Todo funciona
❌ Carnets → QR no aparece = Ver soluciones arriba
```

### 6️⃣ Debug Avanzado

Si sigues teniendo problemas, verifica en la consola:

```javascript
// Pega esto en la consola del navegador
console.log('QRCode disponible:', typeof QRCode !== 'undefined');
```

**Resultado esperado:**
```
QRCode disponible: true
```

**Si dice `false`:**
- La librería no se cargó
- Verifica tu conexión a internet
- Prueba otra CDN (ver Solución A)

### 7️⃣ Última Opción: Carnets sin QR

Si definitivamente no puedes hacer que funcionen los QR:

1. Los carnets seguirán funcionando con el código numérico
2. Los estudiantes pueden ingresar el código manualmente
3. También pueden usar el botón "Escanear QR" si tienen los QR separados

---

## 📞 Checklist de Diagnóstico

Marca lo que has probado:

- [ ] Abrí `prueba-qr.html` en el navegador
- [ ] Abrí la consola (F12) y revisé errores
- [ ] Probé cambiar la CDN en `admin.html`
- [ ] Verifiqué mi conexión a internet
- [ ] Probé en otro navegador (Chrome, Firefox, Edge)
- [ ] Verifiqué que estoy usando HTTPS (en producción)
- [ ] Probé la página `generar-qr.html`
- [ ] Recargué la página con Ctrl+F5 (forzar recarga)

---

## ✅ Si Todo Funciona

Si los QR aparecen correctamente:
1. Los carnets están listos para imprimir
2. Cada carnet tiene código + QR
3. Los estudiantes pueden elegir cómo votar
4. ¡Listo para la votación!

---

## 🆘 Soporte Adicional

Si ninguna solución funciona:
1. Revisa que los estudiantes estén cargados en la base de datos
2. Verifica que el archivo `admin.html` no esté corrupto
3. Prueba borrar caché del navegador (Ctrl+Shift+Delete)
4. Intenta en modo incógnito/privado
5. Verifica permisos del servidor web

---

**Última actualización:** Febrero 2026
