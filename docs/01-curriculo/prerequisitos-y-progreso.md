# Prerequisitos y progreso

> Reglas de desbloqueo, cálculo de avance y reprogramación de repaso.

---

## 1. Regla general de desbloqueo

Una unidad, módulo o etapa se desbloquea cuando se cumplen **todas** estas condiciones:

1. **Prerequisitos declarados completados** (ver grafo).
2. **Evaluación de la etapa previa ≥ 80 %**.
3. **Nivel 3 en las competencias críticas** declaradas para esa etapa.

No existe desbloqueo por tiempo, por cantidad de videos vistos ni por compra.

---

## 2. Grafo detallado de dependencias

| Etapa | Prerequisito | Nivel exigido | Permite inicio anticipado |
|-------|--------------|---------------|---------------------------|
| E0 | — | — | siempre |
| E1 | E0 | entorno verificado | no |
| E2 | E1 | Nivel 3 en C1 | no |
| E3 | E1 (60 %) | Nivel 2 en C1 | **sí, en paralelo con E2** |
| E4 | E2 | Nivel 3 en C1 + 80 % | no |
| E5 | E4 | Nivel 3 en C4 (cliente) | no |
| E6 | E5 (60 %) | Nivel 2 en C4 (servidor) | **sí, al 60 % de E5** |
| E7 | E5 y E6 | Nivel 3 en C4 | no |
| E8 | E7 | Nivel 3 en C5 | no |
| E9 | E8 | Nivel 3 en C2 y C3 | no |
| E10 | E9 y E7 | Nivel 3 en C3, C6 | no |
| E11 | E10 (o E9 para ruta básica) | Nivel 3 en C1–C9 | no |

### Justificación de las excepciones
- **E3 en paralelo con E2:** el estudiante ya produce código desde E1; versionar temprano reduce pérdida de trabajo y crea hábito.
- **E6 al 60 % de E5:** el modelado de datos no requiere API completa, pero sí comprender recursos y contratos.
- **E10 exige E7 completo:** automatizar agentes sin pruebas, APIs y datos sólidos produce sistemas peligrosos; la restricción es pedagógica y de seguridad.

---

## 3. Estados de una unidad

```
locked      → prerequisitos no cumplidos
available   → desbloqueada, sin actividad
in_progress → con actividad registrada
needs_review→ aprobada pero con repaso pendiente
mastered    → aprobada + repasos completados
```

Una unidad `mastered` puede volver a `needs_review` si falla una recuperación acumulativa posterior. **Esto es intencional:** demuestra que el sistema mide retención, no solo desempeño puntual.

---

## 4. Cálculo del progreso

### 4.1 Progreso de unidad

```
progreso_unidad = (peso_lecciones·L + peso_ejercicios·E + peso_evaluacion·V) / total_pesos
```

Pesos por defecto:

| Componente | Peso |
|------------|------|
| Lecciones completadas | 20 % |
| Ejercicios (guiados + independientes) | 45 % |
| Evaluación de unidad | 35 % |

### 4.2 Progreso de etapa

```
progreso_etapa = media ponderada de unidades, penalizando unidades en needs_review
```

### 4.3 Progreso global

Se muestra por **nivel** y por **competencia**, nunca solo por porcentaje de contenido consumido. El estudiante ve:

- % de etapas completadas
- Mapa de competencias C1–C14 con su nivel actual
- Unidades que requieren repaso
- Horas estimadas restantes (calculadas con su propio ritmo)

---

## 5. Reglas de repetición espaciada

Basadas en SM-2 (SuperMemo 2), adaptadas a ejercicios de programación.

### 5.1 Intervalos por calidad de respuesta

`q` = calidad de la recuperación (0–5), derivada del desempeño + pistas usadas.

| q | Resultado | Acción |
|---|-----------|--------|
| 5 | Correcto sin pistas, en tiempo | Siguiente intervalo grande |
| 4 | Correcto con duda menor | Intervalo normal |
| 3 | Correcto con esfuerzo | Intervalo corto |
| 2 | Correcto con pistas | Repetir pronto |
| 1 | Incorrecto, error identificado | Repetir al día siguiente |
| 0 | Incorrecto sin comprensión del error | Reiniciar progresión del concepto |

### 5.2 Fórmula

```
facilidad_inicial = 2.5
facilidad' = facilidad + (0.1 - (5 - q) · (0.08 + (5 - q) · 0.02))
facilidad' = max(1.3, facilidad')

si q < 3 → repeticiones = 0, intervalo = 1 día
si q ≥ 3 → repeticiones += 1
            intervalo = 1 día si repeticiones = 1
                        6 días si repeticiones = 2
                        round(intervalo_anterior · facilidad) si repeticiones > 2
```

### 5.3 Ajustes propios del dominio

- **Ejercicios de código:** se añade penalización si el estudiante usó el nivel 3+ de pistas.
- **Errores conceptuales:** fuerzan `q ≤ 2` aunque el resultado final sea correcto.
- **Intercalado:** al menos el 30 % de la cola diaria debe mezclar conceptos distintos.
- **Límite diario:** máximo 30 repasos/día para evitar sobrecarga (configurable).

---

## 6. Reglas de evaluación acumulativa

- Al final de cada nivel (1, 2, 3) se realiza una **evaluación acumulativa** que re-evalúa competencias de etapas anteriores.
- Si el resultado baja del 70 %, la etapa afectada vuelve a `needs_review`.
- Estas evaluaciones **no bloquean** el avance inmediato, pero sí la certificación del nivel.

---

## 7. Casos especiales

| Caso | Regla |
|------|-------|
| Estudiante con experiencia previa | El diagnóstico permite convalidar unidades, nunca etapas completas. Debe demostrar nivel en competencias críticas. |
| Abandono > 30 días | Se activa "recalibración": evaluación corta de las últimas 3 unidades antes de continuar. |
| Falla repetida (3 veces) en el mismo ejercicio | Se fuerza una lección de refuerzo del concepto base y se registra para analítica. |
| Trampa detectada (solución copiada) | Intento invalidado + ejercicio alternativo obligatorio. |

---

## Documentos relacionados

- [`curriculo-maestro.md`](curriculo-maestro.md)
- [`mapa-competencias.md`](mapa-competencias.md)
- [`rubricas-evaluacion.md`](rubricas-evaluacion.md)
