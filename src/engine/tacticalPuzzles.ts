import { AIDifficulty } from './chessAI';

export interface TacticalPuzzle {
  id: string;
  title: string;
  subtitle: string;
  rating: number;
  theme: string;
  fen: string;
  playerColor: 'w' | 'b';
  /**
   * Alternating sequence of moves in UCI/algebraic from->to format (e.g., ['d8h4', ...])
   * Even indices (0, 2, ...) are player moves; odd indices (1, ...) are automatic opponent replies.
   */
  solution: { from: string; to: string; promotion?: string }[];
  hintText: string;
}

export interface AIPersona {
  level: AIDifficulty;
  name: string;
  title: string;
  elo: number;
  style: string;
  quote: string;
  accentColor: string;
}

export const AI_PERSONAS: Record<AIDifficulty, AIPersona> = {
  1: {
    level: 1,
    name: 'Escudeiro Aldric',
    title: 'Guardião do Pátio',
    elo: 850,
    style: 'Agressivo, mas deixa brechas táticas',
    quote: 'Minha espada está pronta! Vamos ver se você consegue passar pela minha guarda.',
    accentColor: '#34d399',
  },
  2: {
    level: 2,
    name: 'Sor Vaelen',
    title: 'Cavaleiro da Cidadela',
    elo: 1350,
    style: 'Posicional sólido e atento a garfos',
    quote: 'A honra exige paciência. Cada casa no centro será disputada.',
    accentColor: '#fbbf24',
  },
  3: {
    level: 3,
    name: 'Inquisidora Morwen',
    title: 'Estrategista Obsidiana',
    elo: 1750,
    style: 'Tática implacável e ataques ao Rei',
    quote: 'Um único deslize na sua defesa e sua coroa cairá.',
    accentColor: '#f97316',
  },
  4: {
    level: 4,
    name: 'Grão-Mestre Valerius',
    title: 'Oráculo Soberano',
    elo: 2200,
    style: 'Cálculo profundo Alpha-Beta + Livro Mestre',
    quote: 'Já contemplei mil futuros para este tabuleiro. Faça o seu melhor lance.',
    accentColor: '#ef4444',
  },
};

export const TACTICAL_PUZZLES: TacticalPuzzle[] = [
  {
    id: 'opera-mate',
    title: 'O Sacrifício da Ópera',
    subtitle: 'Paul Morphy (Paris, 1858) • Mate em 2',
    rating: 1200,
    theme: 'Sacrifício de Dama & Mate do Corredor',
    // Position right before 16. Qb8+ Nxb8 17. Rd8#
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16',
    playerColor: 'w',
    solution: [
      { from: 'b3', to: 'b8' },
      { from: 'd7', to: 'b8' },
      { from: 'd1', to: 'd8' },
    ],
    hintText: 'Sacrifique a Dama em b8 para desviar o Cavalo defensor e cravar a Torre em d8!',
  },
  {
    id: 'scholars-punish',
    title: 'O Golpe da Coroa',
    subtitle: 'Tática Clássica • Mate em 1',
    rating: 950,
    theme: 'Ataque Direto em f7',
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
    playerColor: 'w',
    solution: [{ from: 'h5', to: 'f7' }],
    hintText: 'A casa f7 está protegida apenas pelo Rei preto, enquanto seu Bispo em c4 dá suporte à Dama.',
  },
  {
    id: 'smothered-mate',
    title: 'O Mate Afogado de Philidor',
    subtitle: 'Legado Medieval • Mate em 2',
    rating: 1550,
    theme: 'Sacrifício de Dama + Mate de Cavalo',
    fen: '5r1k/6pp/7N/8/8/8/1Q6/6K1 w - - 0 1',
    playerColor: 'w',
    solution: [
      { from: 'b2', to: 'g7' },
      { from: 'f8', to: 'g7' },
      { from: 'h6', to: 'f7' },
    ],
    hintText: 'Force a Torre preta a bloquear a última casa de fuga do próprio Rei em g7!',
  },
  {
    id: 'arabian-mate',
    title: 'O Cerco Árabe Antigo',
    subtitle: 'Manuscrito de 840 d.C. • Mate em 2',
    rating: 1400,
    theme: 'Coordenação Cavalo + Torre',
    fen: '7k/2R5/5N2/8/8/8/8/6K1 w - - 0 1',
    playerColor: 'w',
    solution: [{ from: 'c7', to: 'h7' }],
    hintText: 'O Cavalo em f6 controla g8 e defende simultaneamente a casa h7!',
  },
  {
    id: 'boden-mate',
    title: 'As Lâminas Cruzadas de Boden',
    subtitle: 'Londres, 1853 • Mate em 2',
    rating: 1650,
    theme: 'Sacrifício na Dama + Par de Bispos',
    fen: '2kr1b1r/pp1npppp/2p5/8/5B2/2Q5/PPP1BPPP/2KR3R w - - 0 1',
    playerColor: 'w',
    solution: [
      { from: 'c3', to: 'c6' },
      { from: 'b7', to: 'c6' },
      { from: 'e2', to: 'a6' },
    ],
    hintText: 'Abra a diagonal fatal a6-c8 sacrificando a Dama em c6!',
  },
  {
    id: 'anastasia-mate',
    title: 'A Cilada de Anastasia',
    subtitle: 'Mestre Tático • Mate em 2',
    rating: 1850,
    theme: 'Sacrifício de Atração + Corredor Lateral',
    fen: '5r1k/4Nppp/8/8/8/8/5QPP/3R2K1 w - - 0 1',
    playerColor: 'w',
    solution: [
      { from: 'f2', to: 'f7' },
      { from: 'f8', to: 'f7' },
      { from: 'd1', to: 'd8' },
    ],
    hintText: 'Desvie a Torre de f8 com a Dama para liberar o corredor na 8ª fileira!',
  },
];
