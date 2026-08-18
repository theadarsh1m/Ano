using System.Collections;
using UnityEngine;

/// <summary>
/// The base UI panel class. Handles open/close behaviours.
/// </summary>
[RequireComponent(typeof(CanvasGroup))]
public abstract class UIPanel : MonoBehaviour
{
    // --- VARIABLES -----------------------------------------------------------

    [Header("TRANSITION TIMES")]
    [SerializeField][Range(0, 5)] private float _openTime;
    [SerializeField][Range(0, 5)] private float _closeTime;
    
    private Coroutine _fadeCoroutine;
    private CanvasGroup _canvasGroup;
    private bool _isOpened;

    public bool IsOpened => _isOpened;

    // --- ON STARTUP ----------------------------------------------------------

    protected virtual void Awake()
    {
        _canvasGroup = GetComponent<CanvasGroup>();
        ForceHide();
    }

    // --- METHODS -------------------------------------------------------------

    private void ForceHide()
    {
        _canvasGroup.alpha = 0;
        _canvasGroup.interactable = false;
        _canvasGroup.blocksRaycasts = false;
        _isOpened = false;
    }

    public virtual void Open()
    {
        // Enabled immediately to show correct interactable colors during fade.
        _canvasGroup.interactable = true;
        _canvasGroup.blocksRaycasts = true;
        
        if (_fadeCoroutine != null) StopCoroutine(_fadeCoroutine);

        _fadeCoroutine = StartCoroutine(Fade(0, 1, _openTime));
        _isOpened = true;
    }

    public virtual void Close()
    {
        // Disabled immediately to let the player click on the next screen.
        _canvasGroup.interactable = false;
        _canvasGroup.blocksRaycasts = false;

        if (_fadeCoroutine != null) StopCoroutine(_fadeCoroutine);

        _fadeCoroutine = StartCoroutine(Fade(1, 0, _closeTime));
        _isOpened = false;
    }

    private IEnumerator Fade(float start, float end, float duration)
    {
        float timer = 0f;
        while (timer < duration)
        {
            timer += Time.unscaledDeltaTime;
            _canvasGroup.alpha = Mathf.Lerp(start, end, timer/duration);
            yield return null;
        }
        _canvasGroup.alpha = end;
        _fadeCoroutine = null;
    }
}
