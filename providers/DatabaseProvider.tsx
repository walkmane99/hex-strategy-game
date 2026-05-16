import React, { createContext, useContext, useEffect, useState } from 'react';
import { seedInitialData } from '@/db/seed';
import { playerQueries, unitQueries, stageQueries, itemQueries } from '@/db';
import { useAppDispatch } from '@/hooks/redux';
import { loadPlayerData } from '@/store/slices/playerSlice';
import { UnitType } from '@/types/unit';

interface DBContextValue {
  isReady: boolean;
  error: Error | null;
}

const DBContext = createContext<DBContextValue>({ isReady: false, error: null });

export function useDatabase() {
  return useContext(DBContext);
}

interface Props {
  children: React.ReactNode;
}

export function DatabaseProvider({ children }: Props) {
  const dispatch = useAppDispatch();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await seedInitialData();

        const [playerRow, unitsRows] = await Promise.all([
          playerQueries.getPlayer(),
          unitQueries.getUnlockedUnits(),
        ]);

        dispatch(
          loadPlayerData({
            totalPoints: playerRow?.totalPoints ?? 0,
            unlockedUnitTypes: unitsRows.map(u => u.unitType as UnitType),
          })
        );

        setIsReady(true);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsReady(true);
      }
    })();
  }, [dispatch]);

  return <DBContext.Provider value={{ isReady, error }}>{children}</DBContext.Provider>;
}
