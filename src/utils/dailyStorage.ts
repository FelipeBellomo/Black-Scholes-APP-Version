// src/utils/dailyStorage.ts

interface DailyData<T> {
    conteudo: T;
    expiraEm: number;
}

/**
 * Salva os dados no localStorage com validade até as 23:59:59 do dia atual.
 */
export function salvarJsonDiario<T>(chave: string, dadosJson: T): void {
    const agora = new Date();

    const finalDoDia = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate(),
        23, 59, 59, 999
    );

    const pacoteDeDados: DailyData<T> = {
        conteudo: dadosJson,
        expiraEm: finalDoDia.getTime()
    };

    localStorage.setItem(chave, JSON.stringify(pacoteDeDados));
}

/**
 * Tenta resgatar os dados do localStorage. 
 * Retorna null se não existir ou se já passou das 23:59 do dia em que foi salvo.
 */
export function obterJsonDiario<T>(chave: string): T | null {
    const dadosSalvos = localStorage.getItem(chave);

    if (!dadosSalvos) {
        return null;
    }

    try {
        const pacoteDeDados: DailyData<T> = JSON.parse(dadosSalvos);
        const agora = new Date().getTime();

        if (agora > pacoteDeDados.expiraEm) {
            // O dado venceu! Limpamos o armazenamento.
            localStorage.removeItem(chave);
            return null;
        }

        return pacoteDeDados.conteudo;
    } catch (error) {
        console.error("Erro ao processar o JSON salvo:", error);
        return null;
    }
}