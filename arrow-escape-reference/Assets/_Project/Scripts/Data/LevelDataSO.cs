using System.Collections.Generic;
using UnityEngine;

[System.Serializable]
public struct ArrowSaveData
{
    [Tooltip("The starting grid position of the arrow head.")]
    public Vector2Int headPosition;
    
    [Tooltip("The grid direction the arrow moves when tapped (e.g., Up is 0,1).")]
    public Vector2Int moveDirection;
    
    [Tooltip("The grid positions of the tail segments, in order from neck to tip.")]
    public List<Vector2Int> tailPositions;
}

[CreateAssetMenu(menuName = "Game Data/Level Data", fileName = "Level_00")]
public class LevelDataSO : ScriptableObject
{
    [Header("Level Configuration")]
    public int levelNumber;
    
    [Header("Board Data")]
    public List<ArrowSaveData> arrows = new List<ArrowSaveData>();
}