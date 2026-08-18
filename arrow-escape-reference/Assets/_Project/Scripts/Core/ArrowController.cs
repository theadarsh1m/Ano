using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(LineRenderer))]
public class ArrowController : MonoBehaviour
{
    [Header("Events")]
    [SerializeField] private VoidEventChannelSO _arrowEscapedEvent;

    [Header("Visuals")]
    [SerializeField] private Transform _headVisual;

    private Vector2Int _headPos;
    private Vector2Int _dir;
    private List<Vector2Int> _tail = new List<Vector2Int>();
    
    private GridManager _grid;
    private LineRenderer _lr;
    private bool _isMoving = false;
    private GameSettingsSO _settings;
    private System.Action<ArrowController> _onEscapeRelease;

    public void Initialize(ArrowSaveData data, GridManager grid, GameSettingsSO settings, 
        System.Action<ArrowController> releaseCallback)
    {
        _grid = grid;
        _settings = settings;
        _onEscapeRelease = releaseCallback;

        _headPos = data.headPosition;
        _dir = data.moveDirection;
        _tail = new List<Vector2Int>(data.tailPositions);
        _lr = GetComponent<LineRenderer>();
        _isMoving = false;

        // Snap the root object to the actual grid position first.
        Vector3 startWorldPos = new Vector3(_headPos.x, _headPos.y, 0);
        transform.position = startWorldPos;

        if (_headVisual != null)
        {
            _headVisual.position = startWorldPos;
            float angle = Mathf.Atan2(_dir.y, _dir.x) * Mathf.Rad2Deg;
            _headVisual.rotation = Quaternion.AngleAxis(angle - 90, Vector3.forward); 
        }

        _grid.RegisterOccupancy(_headPos, this);
        foreach (var p in _tail) _grid.RegisterOccupancy(p, this);

        UpdateLineRendererVisuals(transform.position);
    }

    public void OnClicked()
    {
        if (_isMoving) return;

        if (IsPathClearToExit()) StartCoroutine(EscapeRoutine());
        else StartCoroutine(BumpRoutine());
    }

    private bool IsPathClearToExit()
    {
        // "Look Ahead" virtual raycast
        Vector2Int checkPos = _headPos + _dir;
        
        while (!_grid.IsOutOfBounds(checkPos))
        {
            if (!_grid.IsCellOpen(checkPos)) 
            {
                return false; // Something is in the way.
            }
            checkPos += _dir;
        }
        
        return true; // Ok to move.
    }

    private System.Collections.IEnumerator EscapeRoutine()
    {
        _isMoving = true;

        while (true)
        {
            Vector2Int nextGridPos = _headPos + _dir;
            Vector3 targetHeadWorldPos = new Vector3(nextGridPos.x, nextGridPos.y, 0);

            // 1. Unregister the tail tip from the grid immediately
            Vector2Int tailTip = _tail.Count > 0 ? _tail[_tail.Count - 1] : _headPos;
            if (!_grid.IsOutOfBounds(tailTip)) _grid.UnregisterOccupancy(tailTip);

            // 2. Calculate the visual start and end positions for the WHOLE snake
            Vector3[] startPositions = new Vector3[_tail.Count + 1];
            Vector3[] endPositions = new Vector3[_tail.Count + 1];

            startPositions[0] = transform.position;
            endPositions[0] = targetHeadWorldPos;

            for (int i = 0; i < _tail.Count; i++)
            {
                startPositions[i + 1] = new Vector3(_tail[i].x, _tail[i].y, 0);
                endPositions[i + 1] = startPositions[i]; 
            }

            // 3. Smoothly Lerp the ENTIRE snake
            float t = 0;
            while (t < 1f)
            {
                t += Time.deltaTime * _settings.moveSpeed;
                
                // Slide root and head
                transform.position = Vector3.Lerp(startPositions[0], endPositions[0], t);
                if (_headVisual != null) _headVisual.position = transform.position;

                // Slide all Line Renderer points
                _lr.positionCount = _tail.Count + 1;
                for (int i = 0; i < startPositions.Length; i++)
                {
                    _lr.SetPosition(i, Vector3.Lerp(startPositions[i], endPositions[i], t));
                }

                yield return null;
            }

            // 4. After the visual slide finishes, update the underlying grid math
            for (int i = _tail.Count - 1; i > 0; i--) _tail[i] = _tail[i - 1];
            if (_tail.Count > 0) _tail[0] = _headPos;
            _headPos = nextGridPos;

            // 5. Check if fully escaped
            if (_grid.IsOutOfBounds(tailTip)) break;
        }

        // We escaped the board cleanly!
        _arrowEscapedEvent.RaiseEvent();
        
        // Return to the object pool safely
        _onEscapeRelease?.Invoke(this); 
        
        _isMoving = false;
    }

    private System.Collections.IEnumerator BumpRoutine()
    {
        _isMoving = true;
        
        // A simple "shake" animation
        Vector3 originalPos = transform.position;
        Vector3 bumpPos = originalPos + new Vector3(_dir.x, _dir.y, 0) * _settings.bumpDistance;

        float t = 0;
        while (t < 1f)
        {
            t += Time.deltaTime * _settings.bumpSpeed;
            
            // Smoothly ping-pong back and forth
            float lerpStep = Mathf.PingPong(t, 0.5f) * 2f; 
            Vector3 currentPos = Vector3.Lerp(originalPos, bumpPos, lerpStep);
            
            transform.position = currentPos;
            if (_headVisual != null) _headVisual.position = currentPos;
            UpdateLineRendererVisuals(currentPos);
            
            yield return null;
        }

        transform.position = originalPos;
        if (_headVisual != null) _headVisual.position = originalPos;
        UpdateLineRendererVisuals(originalPos);
        
        _isMoving = false;
    }

    private void UpdateLineRendererVisuals(Vector3 currentHeadWorldPos)
    {
        _lr.positionCount = _tail.Count + 1;
        _lr.SetPosition(0, currentHeadWorldPos);
        for (int i = 0; i < _tail.Count; i++)
        {
            _lr.SetPosition(i + 1, new Vector3(_tail[i].x, _tail[i].y, 0));
        }
    }
}