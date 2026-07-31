/**
 * Convierte una fecha en formato YYYY-MM-DD a DD/MM/AAAA para el usuario.
 */
export function formatDateToLocal(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

/**
 * Obtiene la fecha inicial por defecto dentro del curso lectivo 2026 (02/02/2026 - 30/11/2026)
 * y garantiza que no sea un fin de semana.
 */
export function getInitialDate2026(): string {
    const today = new Date().toLocaleDateString('en-CA');
    let dateVal = today;
    
    // Validar límites del curso lectivo 2026
    if (dateVal < '2026-02-02') dateVal = '2026-02-02';
    if (dateVal > '2026-11-30') dateVal = '2026-11-30';

    // Evitar fines de semana en la fecha por defecto
    const d = new Date(dateVal + 'T00:00:00');
    const day = d.getDay(); // 0 = Domingo, 6 = Sábado
    if (day === 0) { // Domingo -> Mover al Lunes
        const nextMonday = new Date(d);
        nextMonday.setDate(d.getDate() + 1);
        return nextMonday.toLocaleDateString('en-CA');
    } else if (day === 6) { // Sábado -> Mover al Viernes
        const prevFriday = new Date(d);
        prevFriday.setDate(d.getDate() - 1);
        return prevFriday.toLocaleDateString('en-CA');
    }
    return dateVal;
}

/**
 * Determina el semestre (periodo) inicial según la fecha actual:
 * - Antes del 11 de julio de 2026 → Semestre 1
 * - A partir del 11 de julio de 2026 → Semestre 2
 * El usuario siempre puede cambiar manualmente el semestre desde el Sidebar.
 */
export function getInitialPeriodo(): number {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    return today < '2026-07-11' ? 1 : 2;
}

/**
 * Determina el semestre (periodo) que corresponde a una fecha dada.
 * Igual que getInitialPeriodo pero para cualquier fecha arbitraria.
 */
export function getPeriodoForDate(dateStr: string): number {
    if (!dateStr) return 1;
    const year = dateStr.split('-')[0];
    const cutOffDate = `${year}-07-11`;
    return dateStr >= cutOffDate ? 2 : 1;
}
