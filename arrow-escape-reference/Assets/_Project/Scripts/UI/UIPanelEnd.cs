using UnityEngine;

public class UIPanelEnd : UIPanel
{
    [Header("Elements")]
    [SerializeField] private GameObject _nextLevelTxt;
    [SerializeField] private GameObject _allDoneTxt;

    public void OpenNext()
    {
        _nextLevelTxt.SetActive(true);
        _allDoneTxt.SetActive(false);

        base.Open();
    }

    public void OpenEnd()
    {
        _nextLevelTxt.SetActive(false);
        _allDoneTxt.SetActive(true);

        base.Open();
    }
}
