using UnityEngine;
using UnityEngine.Events;

[CreateAssetMenu(menuName = "Events/Void Event Channel", fileName = "New Void Event")]
public class VoidEventChannelSO : ScriptableObject
{
    public UnityAction OnEventRaised;

    public void RaiseEvent()
    {
        OnEventRaised?.Invoke();
    }
}