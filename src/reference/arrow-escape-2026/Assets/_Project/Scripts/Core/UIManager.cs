using UnityEngine;
using System.Collections;

public class UIManager : MonoBehaviour
{
    [Header("UI Panels")]
    [SerializeField] private UIPanel _mainMenuPanel;
    [SerializeField] private UIPanelEnd _endPanel;

    [Header("Event Listening")]
    [SerializeField] private VoidEventChannelSO _levelWonEvent;
    [SerializeField] private VoidEventChannelSO _gameWonEvent;
    [SerializeField] private VoidEventChannelSO _returnToMenuEvent;
    [SerializeField] private VoidEventChannelSO _levelStartedEvent;

    [Header("Event Broadcasting (Intents)")]
    [SerializeField] private VoidEventChannelSO _playNextLevelIntentEvent; 

    private void OnEnable()
    {
        if (_levelWonEvent != null) _levelWonEvent.OnEventRaised += ShowLevelWonScreen;
        if (_gameWonEvent != null) _gameWonEvent.OnEventRaised += ShowGameWonScreen;
        if (_returnToMenuEvent != null) _returnToMenuEvent.OnEventRaised += ShowMainMenu;
        if (_levelStartedEvent != null) _levelStartedEvent.OnEventRaised += HideAllPanels;
    }

    private void OnDisable()
    {
        if (_levelWonEvent != null) _levelWonEvent.OnEventRaised -= ShowLevelWonScreen;
        if (_gameWonEvent != null) _gameWonEvent.OnEventRaised -= ShowGameWonScreen;
        if (_returnToMenuEvent != null) _returnToMenuEvent.OnEventRaised -= ShowMainMenu;
        if (_levelStartedEvent != null) _levelStartedEvent.OnEventRaised -= HideAllPanels;
    }

    private void Start()
    {
        ShowMainMenu();
    }

    private void ShowMainMenu() => StartCoroutine(DelayedMenuTransitionRoutine());

    private IEnumerator DelayedMenuTransitionRoutine()
    {
        // Instantly begin fading out the End Panel, if opened.
        if (_endPanel.IsOpened) _endPanel.Close();

        yield return new WaitForSeconds(1);
        _mainMenuPanel.Open();
    }

    private void ShowLevelWonScreen() => _endPanel.OpenNext();

    private void ShowGameWonScreen() => _endPanel.OpenEnd();

    private void HideAllPanels()
    {
        // The GameManager tells us the level started, so we clear the screen for gameplay.
        if (_mainMenuPanel.IsOpened) _mainMenuPanel.Close();
        if (_endPanel.IsOpened) _endPanel.Close();
    }

    public void OnPlayOrNextButtonClicked()
    {
        // We strictly fire the intent and do absolutely nothing else. 
        // We wait for the GameManager to dictate the next UI state.
        if (_playNextLevelIntentEvent != null) _playNextLevelIntentEvent.RaiseEvent();
    }
}