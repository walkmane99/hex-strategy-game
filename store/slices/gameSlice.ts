import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { VictoryCondition } from '@/types/map';

export type GamePhase =
  | 'title'
  | 'stage-select'
  | 'strategy'
  | 'deploy'
  | 'player_turn'
  | 'enemy_turn'
  | 'result';

export type TurnOwner = 'player' | 'enemy';

interface GameState {
  phase: GamePhase;
  currentTurn: number;
  turnOwner: TurnOwner;
  currentStageId: string | null;
  victoryCondition: VictoryCondition;
  turnLimit: number;
  isGameOver: boolean;
  winner: TurnOwner | 'draw' | null;
  outcomeReason: string | null;
  isAIThinking: boolean;
}

const initialState: GameState = {
  phase: 'title',
  currentTurn: 1,
  turnOwner: 'player',
  currentStageId: null,
  victoryCondition: 'elimination',
  turnLimit: 20,
  isGameOver: false,
  winner: null,
  outcomeReason: null,
  isAIThinking: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    setPhase: (state, action: PayloadAction<GamePhase>) => {
      state.phase = action.payload;
    },
    startBattle: (state, action: PayloadAction<{ stageId: string; victoryCondition: VictoryCondition; turnLimit: number }>) => {
      state.currentStageId = action.payload.stageId;
      state.victoryCondition = action.payload.victoryCondition;
      state.turnLimit = action.payload.turnLimit;
      state.currentTurn = 1;
      state.turnOwner = 'player';
      state.isGameOver = false;
      state.winner = null;
      state.phase = 'player_turn';
    },
    endPlayerTurn: (state) => {
      state.turnOwner = 'enemy';
      state.phase = 'enemy_turn';
      state.isAIThinking = true;
    },
    endEnemyTurn: (state) => {
      state.currentTurn += 1;
      state.turnOwner = 'player';
      state.phase = 'player_turn';
      state.isAIThinking = false;
    },
    setGameOver: (state, action: PayloadAction<{ winner: 'player' | 'enemy' | 'draw' }>) => {
      state.isGameOver = true;
      state.winner = action.payload.winner;
      state.phase = 'result';
    },
    endBattle: (state, action: PayloadAction<{ winner: 'player' | 'enemy' | 'draw'; reason: string }>) => {
      state.isGameOver = true;
      state.winner = action.payload.winner;
      state.outcomeReason = action.payload.reason;
      state.phase = 'result';
    },
    resetGameOutcome: (state) => {
      state.isGameOver = false;
      state.winner = null;
      state.outcomeReason = null;
    },
    setAIThinking: (state, action: PayloadAction<boolean>) => {
      state.isAIThinking = action.payload;
    },
    resetGame: () => initialState,
  },
});

export const {
  setPhase,
  startBattle,
  endPlayerTurn,
  endEnemyTurn,
  setGameOver,
  endBattle,
  resetGameOutcome,
  setAIThinking,
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
