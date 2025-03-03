export interface CryptoWord {
    word: string;
    emoji: string;
    hint: string;
}

export const cryptoVocabulary: CryptoWord[] = [
    { word: "bitcoin", emoji: "₿", hint: "The first and most famous cryptocurrency" },
    { word: "blockchain", emoji: "🔗", hint: "A decentralized digital ledger" },
    { word: "wallet", emoji: "👝", hint: "Where you store your crypto" },
    { word: "mining", emoji: "⛏️", hint: "Process of validating transactions and earning rewards" },
    { word: "hodl", emoji: "💎", hint: "Crypto slang for holding onto your assets" },
    { word: "altcoin", emoji: "🪙", hint: "Any cryptocurrency that isn't Bitcoin" },
    { word: "exchange", emoji: "🏦", hint: "Platform for trading cryptocurrencies" },
    { word: "staking", emoji: "🥩", hint: "Locking up crypto to support network operations" },
    { word: "defi", emoji: "🏗️", hint: "Decentralized financial services" },
    { word: "nft", emoji: "🎨", hint: "Digital assets with unique properties" }
]; 