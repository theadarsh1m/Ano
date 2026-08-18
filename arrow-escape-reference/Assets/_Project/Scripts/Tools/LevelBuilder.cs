using UnityEngine;
using System.Collections.Generic;

#if UNITY_EDITOR
using UnityEditor;
#endif

public class LevelBuilder : MonoBehaviour
{
    [Header("Bake Target")]
    public LevelDataSO targetLevelData;

    [ContextMenu("Bake Level Data")]
    public void BakeLevel()
    {
        if (targetLevelData == null)
        {
            Debug.LogError("Assign a LevelDataSO first!");
            return;
        }

        ArrowAuthoring[] arrows = FindObjectsByType<ArrowAuthoring>(FindObjectsSortMode.None);
        targetLevelData.arrows.Clear();

        foreach (var arrow in arrows)
        {
            if (arrow.transform.childCount == 0)
            {
                Debug.LogError($"Arrow at {arrow.transform.position} has no tail! Cannot calculate direction automatically. Skipping.");
                continue; // Skip baking this invalid arrow
            }

            ArrowSaveData data = new ArrowSaveData();
            
            // Calculate Head Position
            data.headPosition = new Vector2Int(
                Mathf.RoundToInt(arrow.transform.position.x),
                Mathf.RoundToInt(arrow.transform.position.y)
            );

            // Get the Neck Position
            Transform neckTransform = arrow.transform.GetChild(0);
            Vector2Int neckPosition = new Vector2Int(
                Mathf.RoundToInt(neckTransform.position.x),
                Mathf.RoundToInt(neckTransform.position.y)
            );

            // Head minus Neck gives us the exact forward direction vector.
            data.moveDirection = data.headPosition - neckPosition;

            // Calculate Tail Positions
            data.tailPositions = new List<Vector2Int>();
            foreach (Transform child in arrow.transform)
            {
                data.tailPositions.Add(new Vector2Int(
                    Mathf.RoundToInt(child.position.x),
                    Mathf.RoundToInt(child.position.y)
                ));
            }
            
            targetLevelData.arrows.Add(data);
        }

        #if UNITY_EDITOR
        EditorUtility.SetDirty(targetLevelData);
        AssetDatabase.SaveAssets();
        #endif

        Debug.Log($"Successfully baked {arrows.Length} arrows into {targetLevelData.name}!");
    }
}