const savePrediction = useCallback(
  async (
    prediction: Omit<Prediction, 'id' | 'updatedAt'>
  ): Promise<{ synced: boolean }> => {
    const now = new Date().toISOString();

    const existingPrediction = predictionsRef.current.find(
      (p) => p.raceId === prediction.raceId
    );

    const isEdit = !!existingPrediction;
    const prevMeta = editCountsRef.current[prediction.raceId];

    const newCount = isEdit ? (prevMeta?.count ?? 1) + 1 : 1;

    const newEditMeta = {
      count: newCount,
      lastEditAt: now,
    };

    const nextEditCounts = {
      ...editCountsRef.current,
      [prediction.raceId]: newEditMeta,
    };

    setEditCounts(nextEditCounts);
    editCountsRef.current = nextEditCounts;

    AsyncStorage.setItem(
      STORAGE_KEYS.editCounts,
      JSON.stringify(nextEditCounts)
    ).catch(() => {});

    const currentUsername =
      localProfileRef.current.username &&
      localProfileRef.current.username.trim() !== ''
        ? localProfileRef.current.username.trim()
        : null;

    const currentDisplayName =
      localProfileRef.current.displayName &&
      localProfileRef.current.displayName.trim() !== ''
        ? localProfileRef.current.displayName.trim()
        : currentUsername;

    const savedPrediction: Prediction = normalizePrediction({
      id: existingPrediction?.id || generateId(),
      raceId: prediction.raceId,
      top10: prediction.top10 ?? [],
      fastestLap: prediction.fastestLap ?? null,
      dnf: prediction.dnf ?? null,
      pointsEarned: prediction.pointsEarned ?? existingPrediction?.pointsEarned ?? 0,
      sprintTop8: prediction.sprintTop8 ?? [],
      sprintPointsEarned:
        prediction.sprintPointsEarned ??
        existingPrediction?.sprintPointsEarned ??
        0,
      updatedAt: now,

      // Force the latest profile name every time Save Prediction is pressed.
      username: currentUsername,
      displayName: currentDisplayName,
    });

    const nextPredictions = [
      ...predictionsRef.current.filter((p) => p.raceId !== prediction.raceId),
      savedPrediction,
    ];

    setPredictions(nextPredictions);
    predictionsRef.current = nextPredictions;

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.predictions,
        JSON.stringify(nextPredictions)
      );
    } catch (e) {
      console.log('[savePrediction] Local AsyncStorage save failed:', e);
    }

    const resolveUserId = async (): Promise<string | null> => {
      if (session?.user?.id) return session.user.id;

      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.log('[savePrediction] getSession error:', error.message);
        }

        return data.session?.user?.id ?? null;
      } catch (e: any) {
        console.log('[savePrediction] getSession threw:', e?.message || e);
        return null;
      }
    };

    const userId = await resolveUserId();

    console.log('[savePrediction] Save pressed:', {
      raceId: savedPrediction.raceId,
      userId,
      isSupabaseConfigured,
      username: currentUsername,
      displayName: currentDisplayName,
      top10: savedPrediction.top10,
      fastestLap: savedPrediction.fastestLap,
      dnf: savedPrediction.dnf,
    });

    if (!userId) {
      console.log('[savePrediction] Supabase not updated: no logged-in user.');
      return { synced: false };
    }

    if (!isSupabaseConfigured) {
      console.log('[savePrediction] Supabase not updated: not configured.');
      return { synced: false };
    }

    const payload = {
      user_id: userId,
      race_id: savedPrediction.raceId,
      username: currentUsername,
      display_name: currentDisplayName,
      predicted_top10: savedPrediction.top10,
      predicted_fastest_lap: savedPrediction.fastestLap,
      predicted_dnf: savedPrediction.dnf,
      points_earned: savedPrediction.pointsEarned ?? 0,
      predicted_sprint_top8: savedPrediction.sprintTop8 ?? [],
      sprint_points_earned: savedPrediction.sprintPointsEarned ?? 0,
      updated_at: savedPrediction.updatedAt,
    };

    console.log('[savePrediction] Supabase upsert payload:', payload);

    const { data, error } = await supabase
      .from('user_predictions')
      .upsert(payload, {
        onConflict: 'user_id,race_id',
      })
      .select('*')
      .single();

    if (error) {
      console.log('[savePrediction] Supabase upsert failed:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      return { synced: false };
    }

    console.log('[savePrediction] Supabase upsert success:', data);

    lastSaveTimeRef.current = Date.now();

    return { synced: true };
  },
  [session]
);