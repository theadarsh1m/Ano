using UnityEngine;

public class ArrowAuthoring : MonoBehaviour
{
    private void OnDrawGizmos()
    {
        // Draw the Head
        Gizmos.color = Color.green;
        Gizmos.DrawSphere(transform.position, 0.3f);

        if (transform.childCount == 0) return;

        // Draw the Tail Connections
        Gizmos.color = Color.yellow;
        Vector3 previousPos = transform.position;

        foreach (Transform child in transform)
        {
            Gizmos.DrawLine(previousPos, child.position);
            Gizmos.DrawWireSphere(child.position, 0.2f);
            previousPos = child.position;
        }
    }
}