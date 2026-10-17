# Guía de solicitud al SCF (Stellar Community Fund)

Guía corta para el fundador. Revisada el 2026-10-16. El borrador completo de la solicitud está en [`scf-application.md`](scf-application.md) (en inglés, porque así se envía).

## Qué es y cuánto se pide

- **SCF Build Award:** hasta USD 150.000 en XLM. Halora pide **USD 72.000** (pedir el máximo no se espera y los presupuestos inflados rinden mal en la revisión).
- **Pagos por tramos:** 10% al aceptar (T0), 20% al terminar el MVP (T1), 30% en testnet (T2), 40% en mainnet (T3).
- **Duración máxima:** 6 meses. Cada tramo se debe entregar dentro de los 90 días siguientes al pago anterior; si no, se pierde el resto, salvo aviso previo a communityfund@stellar.org.
- **No se puede presupuestar:** auditorías (se piden aparte al Audit Bank), marketing, temas legales, ni trabajo pasado.
- **Track recomendado: Open Track.** Integration exige tracción previa y una métrica on-chain para el último tramo; RFP exige un RFP activo y los del Q4 2026 figuran como "coming soon".

## Fechas confirmadas

| Ronda   | Fase                              | Fecha                                                                                                                                                   |
| ------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCF #46 | Cierre de envío del Build         | **8 de noviembre de 2026**                                                                                                                              |
| SCF #46 | Revisión del panel                | 11 al 18 de noviembre de 2026                                                                                                                           |
| SCF #46 | Voto de la comunidad (Open Track) | 23 de noviembre al 3 de diciembre de 2026                                                                                                               |
| SCF #47 | Todas                             | No publicadas aún. Las rondas son cada unas 6 semanas, así que se espera entre finales de diciembre de 2026 y enero de 2027 (estimación, no confirmada) |

Fuente: [página de SCF #46](https://communityfund.stellar.org/awards/recxrSMYwAl8vcglg) y [handbook del SCF](https://stellar.gitbook.io/scf-handbook/scf-awards/build-award).

## Pasos, en orden

1. **Hoy: llenar el formulario de interés** en [communityfund.stellar.org](https://communityfund.stellar.org). Está siempre abierto y se revisa de forma continua. Indicar **Open Track**. Si alguien de la comunidad Stellar te refiere, pedirle su **código de referido** e incluirlo (pesa mucho en la selección).
2. **Esperar la invitación por correo.** Solo los proyectos elegibles reciben la invitación con la fecha límite de la ronda. Si llega con tiempo para SCF #46, enviar antes del 8 de noviembre; si no, preparar todo para SCF #47 sin prisas.
3. **Completar el KYC** en [stellar.org/bd-kyc](https://stellar.org/bd-kyc). Si aplican como equipo, cada contribuidor lo llena.
4. **Enviar el Build** con el contenido de `scf-application.md`, ya con los campos `[FOUNDER TO FILL]` completos.
5. **Pre-revisión:** el equipo del SCF puede pedir correcciones. Es la última oportunidad para arreglar errores básicos.
6. **Panel y voto comunitario.** Conviene estar activo en el Discord de Stellar Dev durante el voto.

## Qué preparar antes de enviar

- **Equipo:** nombres, roles, experiencia demostrable (GitHub, productos lanzados), horas por semana. En el Open Track se pide evidencia de que el equipo ya construyó productos similares.
- **Video corto del equipo** presentando el proyecto (recomendado en Open Track).
- **Declaración honesta del uso de IA** en documentos y código (requisito del Open Track).
- **Validación del problema:** conversaciones con desarrolladores de agentes o proveedores x402, cartas de interés, lista de espera. El criterio pide necesidad validada o tracción verificable.
- **Repositorio público** con lo que ya funciona (contrato, SDK) y una documentación unificada (arquitectura, roadmap, plan de pruebas).
- **Licencia open source** elegida (recomendado Apache-2.0).
- **Tarifas reales** del equipo para confirmar el presupuesto.

## Riesgos de la solicitud a tener presentes

- El Open Track no es para equipos sin experiencia previa en el dominio o en Stellar; en ese caso el SCF sugiere **Instawards**. Si el perfil del equipo es débil, conviene considerarlo.
- Hay proyectos parecidos en el ecosistema (por ejemplo REAPP, y herramientas premiadas en SCF #44 para cuentas OpenZeppelin), y SDF anunció un servidor x402-MCP con políticas de gasto. La solicitud debe explicar claramente en qué se diferencia Halora (ver `docs/strategy/competitive-landscape.md`).
- No afirmar nada que no esté verificado. La compatibilidad de una cuenta Halora con los facilitadores x402 está verificada solo a nivel de especificación; la prueba real es un criterio de T1.

## Documentos relacionados

- [`../strategy/product-brief.md`](../strategy/product-brief.md)
- [`../strategy/roadmap.md`](../strategy/roadmap.md)
- [`../strategy/decision-log.md`](../strategy/decision-log.md)
- [`../strategy/integration-verification-matrix.md`](../strategy/integration-verification-matrix.md)
- [`../strategy/competitive-landscape.md`](../strategy/competitive-landscape.md)
