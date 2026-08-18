using System.Collections.Generic;
using UnityEngine;

public class GameManager : MonoBehaviour
{
    [SerializeField] private GameSettingsSO _settings;
    
    [Header("Event Listening")]
    [SerializeField] private VoidEventChannelSO _arrowEscapedEvent;
    [SerializeField] private VoidEventChannelSO _playNextLevelIntentEvent;

    [Header("Event Broadcasting")]
    [SerializeField] private VoidEventChannelSO _levelWonEvent;
    [SerializeField] private VoidEventChannelSO _levelStartedEvent;
    [SerializeField] private VoidEventChannelSO _gameWonEvent;
    [SerializeField] private VoidEventChannelSO _returnToMenuEvent;

    [Header("Dependencies")]
    [SerializeField] private LevelLoader _levelLoader;

    private int _arrowsRemaining;
    private int _currentLevelIndex = -1; // Start at -1 so the first "Next" click loads Level 0

    private void OnEnable()
    {
        if (_arrowEscapedEvent != null) _arrowEscapedEvent.OnEventRaised += HandleArrowEscaped;
        if (_playNextLevelIntentEvent != null) _playNextLevelIntentEvent.OnEventRaised += LoadNextLevel;
    }

    private void OnDisable()
    {
        if (_arrowEscapedEvent != null) _arrowEscapedEvent.OnEventRaised -= HandleArrowEscaped;
        if (_playNextLevelIntentEvent != null) _playNextLevelIntentEvent.OnEventRaised -= LoadNextLevel;
    }

    private void LoadNextLevel()
    {
        _currentLevelIndex++;
        
        // Check if we just tried to load a level that doesn't exist
        if (_currentLevelIndex >= _settings.levels.Count)
        {
            _currentLevelIndex = -1; // Reset so "Play" starts from Level 1 again
            if (_returnToMenuEvent != null) _returnToMenuEvent.RaiseEvent();
            return;
        }

        StartLevel(_currentLevelIndex);
    }

    private void StartLevel(int levelIndex)
    {
        if (_settings.levels == null || _settings.levels.Count == 0)
        {
            Debug.LogError("No levels assigned in the GameManager!");
            return;
        }

        // Safety check to ensure we don't load out of bounds
        if (levelIndex >= _settings.levels.Count)
        {
            Debug.Log("Game Beaten! All levels complete.");
            return; 
        }

        _currentLevelIndex = levelIndex;
        LevelDataSO levelToLoad = _settings.levels[_currentLevelIndex];
        
        _levelLoader.LoadLevel(levelToLoad);
        _arrowsRemaining = levelToLoad.arrows.Count;
        
        // Tell the UIManager that the level is ready and it should show the HUD!
        if (_levelStartedEvent != null) _levelStartedEvent.RaiseEvent();
    }

    private void HandleArrowEscaped()
    {
        _arrowsRemaining--;

        if (_arrowsRemaining <= 0)
        {
            // Check if this was the last level in our list
            if (_currentLevelIndex >= _settings.levels.Count - 1)
            {
                if (_gameWonEvent != null) _gameWonEvent.RaiseEvent();
            }
            else
            {
                if (_levelWonEvent != null) _levelWonEvent.RaiseEvent();
            }
        }
    }
}