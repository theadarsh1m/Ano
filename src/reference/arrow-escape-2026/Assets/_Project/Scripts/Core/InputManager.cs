using UnityEngine;
using UnityEngine.InputSystem;

public class InputManager : MonoBehaviour
{
    [SerializeField] private GridManager _grid;
    private Camera _mainCam;

    private void Awake()
    {
        _mainCam = Camera.main;
    }

    private void Update()
    {
        if (Pointer.current != null && Pointer.current.press.wasPressedThisFrame)
        {
            Vector2 screenPosition = Pointer.current.position.ReadValue();
            Vector3 worldPosition = _mainCam.ScreenToWorldPoint(screenPosition);
            
            // Convert the raw world float to our perfect integer grid coordinate
            Vector2Int gridPos = new Vector2Int(
                Mathf.RoundToInt(worldPosition.x),
                Mathf.RoundToInt(worldPosition.y)
            );

            // Ask the grid: "Is anyone sitting at this exact coordinate?"
            if (_grid.TryGetArrow(gridPos, out ArrowController arrow))
            {
                arrow.OnClicked();
            }
        }
    }
}