using System.Collections.Generic;
using UnityEngine;

[CreateAssetMenu(menuName = "Game Data/Game Settings", fileName = "GameSettings")]
public class GameSettingsSO : ScriptableObject
{
    [Header("Arrow Animation")]
    public float moveSpeed = 15f;
    public float bumpSpeed = 10f;
    public float bumpDistance = 0.2f;

    [Header("Level Spawning")]
    public float initialSpawnDelay = 0.5f;
    public float cascadeSpawnDelay = 0.05f;

    [Header("Camera")]
    public float cameraPadding = 4f;
    
    [Header("Level Sequence")]
    public List<LevelDataSO> levels;
}