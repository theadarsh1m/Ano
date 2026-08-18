using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Pool;

public class LevelLoader : MonoBehaviour
{
    [SerializeField] private ArrowController _arrowPrefab;
    [SerializeField] private GridManager _grid;
    [SerializeField] private GameSettingsSO _settings;

    private ObjectPool<ArrowController> _arrowPool;
    private Camera _mainCam;
    private List<ArrowController> _activeArrows = new List<ArrowController>();

    private void Awake()
    {
        _mainCam = Camera.main;
        _arrowPool = new ObjectPool<ArrowController>(
            createFunc: () => Instantiate(_arrowPrefab, transform),
            actionOnGet: arrow => arrow.gameObject.SetActive(true),
            actionOnRelease: arrow => arrow.gameObject.SetActive(false),
            actionOnDestroy: arrow => Destroy(arrow.gameObject),
            defaultCapacity: 20,
            maxSize: 50
        );
    }

    public void LoadLevel(LevelDataSO levelData)
    {
        StartCoroutine(SpawnLevelRoutine(levelData));
    }

    private IEnumerator SpawnLevelRoutine(LevelDataSO levelData)
    {
        _grid.ClearGrid();
        
        // Arrows cleanup.
        foreach (var arrow in _activeArrows)
        {
            if (arrow.gameObject.activeInHierarchy) _arrowPool.Release(arrow);
        }
        _activeArrows.Clear();

        // 1. Calculate Bounds & Frame Camera First
        int minX = int.MaxValue, minY = int.MaxValue;
        int maxX = int.MinValue, maxY = int.MinValue;

        foreach (var data in levelData.arrows)
        {
            UpdateBounds(data.headPosition, ref minX, ref maxX, ref minY, ref maxY);
            foreach (var tail in data.tailPositions) UpdateBounds(tail, ref minX, ref maxX, ref minY, ref maxY);
        }

        FrameCamera(minX, maxX, minY, maxY);
        _grid.SetBoardBounds(new RectInt(minX, minY, maxX - minX, maxY - minY));

        // 2. Wait for UI to settle / Small initial delay
        yield return new WaitForSeconds(_settings.initialSpawnDelay);

        // 3. Staggered "Cascade" Spawning
        foreach (var data in levelData.arrows)
        {
            ArrowController arrow = _arrowPool.Get();
            
            // We pass the Release method as a callback so the Arrow can kill itself cleanly
            arrow.Initialize(data, _grid, _settings, (a) => ReleaseArrow(a));
            _activeArrows.Add(arrow);

            if (_settings.cascadeSpawnDelay > 0)
                yield return new WaitForSeconds(_settings.cascadeSpawnDelay);
        }
    }

    private void ReleaseArrow(ArrowController arrow)
    {
        if (_activeArrows.Contains(arrow))
        {
            _activeArrows.Remove(arrow);
            _arrowPool.Release(arrow);
        }
    }

    private void UpdateBounds(Vector2Int pos, ref int minX, ref int maxX, ref int minY, ref int maxY)
    {
        if (pos.x < minX) minX = pos.x;
        if (pos.x > maxX) maxX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.y > maxY) maxY = pos.y;
    }

    private void FrameCamera(int minX, int maxX, int minY, int maxY)
    {
        float centerX = (minX + maxX) / 2f;
        float centerY = (minY + maxY) / 2f;
        _mainCam.transform.position = new Vector3(centerX, centerY, -10f);

        float boundsWidth = (maxX - minX) + _settings.cameraPadding;
        float boundsHeight = (maxY - minY) + _settings.cameraPadding;

        float sizeBasedOnWidth = (boundsWidth / 2f) / _mainCam.aspect;
        _mainCam.orthographicSize = Mathf.Max(boundsHeight / 2f, sizeBasedOnWidth);
    }
}