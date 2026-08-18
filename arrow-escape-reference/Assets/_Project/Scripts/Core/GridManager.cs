using System.Collections.Generic;
using NUnit.Framework;
using UnityEngine;

// Review Dictionary use for better collection.

public class GridManager : MonoBehaviour
{
    // Key: Grid Coordinate | Value: The ArrowController occupying it
    private Dictionary<Vector2Int, ArrowController> _occupancy = new Dictionary<Vector2Int, ArrowController>();

    private RectInt _boardBounds;

    public void RegisterOccupancy(Vector2Int pos, ArrowController arrow) => _occupancy[pos] = arrow;
    public void UnregisterOccupancy(Vector2Int pos) => _occupancy.Remove(pos);

    public bool IsCellOpen(Vector2Int pos) => !_occupancy.ContainsKey(pos);

    public void ClearGrid() => _occupancy.Clear();

    // Returns true if an arrow is found, and outputs the reference
    public bool TryGetArrow(Vector2Int pos, out ArrowController arrow)
    {
        return _occupancy.TryGetValue(pos, out arrow);
    }

    public void SetBoardBounds(RectInt bounds)
    {
        // We inflate the bounds by 1 so the arrows have to fully step OFF the board to escape
        _boardBounds = new RectInt(bounds.xMin - 1, bounds.yMin - 1, bounds.width + 2, bounds.height + 2);
    }

    public bool IsOutOfBounds(Vector2Int pos)
    {
        return !_boardBounds.Contains(pos);
    }
}