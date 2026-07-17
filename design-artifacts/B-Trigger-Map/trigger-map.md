# Trigger Map: FestGrid

This document maps our business goals to user motivations, providing a strategic reference for design and development.

## Trigger Map Diagram

```mermaid
graph TD
    subgraph Business Goals
        direction LR
        G1("Reach 1000 contributing users in 6 months")
        G2("Users add avg. 2 events/month")
        G3("Add 50 new events/week")
        G4("80% BYOK success rate")
    end

    subgraph Personas
        direction LR
        P1("Sarah, The Busy Parent")
        P2("Alex, The Social Explorer")
    end

    subgraph "Driving Forces (Sarah)"
        direction LR
        SF_Pos1("Create memorable family experiences")
        SF_Pos2("Feel organized and in control")
        SF_Neg1("Fear of kids being bored")
        SF_Neg2("Frustration of wasting time")
    end

    subgraph "Driving Forces (Alex)"
        direction LR
        AF_Pos1("Feel like an 'insider'")
        AF_Pos2("Build a social circle")
        AF_Neg1("Fear of missing out (FOMO)")
        AF_Neg2("Frustration of losing track of events")
    end

    G1 --> P2
    G2 --> P1
    G3 --> P2
    G4 --> P2

    P1 --> SF_Pos1
    P1 --> SF_Pos2
    P1 --> SF_Neg1
    P1 --> SF_Neg2

    P2 --> AF_Pos1
    P2 --> AF_Pos2
    P2 --> AF_Neg1
    P2 --> AF_Neg2
```

## Summary of Strategic Connections

-   **Sarah, The Busy Parent** is our primary target group. Her engagement (adding events to her calendar) is a key driver for making the platform a valuable, long-term resource. By addressing her fears of her kids being bored and the frustration of planning, we will drive adoption and retention in this large user segment.

-   **Alex, The Social Explorer** is our key secondary target group. His desire to be an 'insider' and his frustration with losing track of events make him the ideal `contributing_user`. He will be instrumental in seeding the platform with content (achieving the "Comprehensive Event Coverage" goal) and driving the success of the BYOK model.

## Design Focus Statement

> Our primary design focus is to **empower 'Sarah, The Busy Parent' to effortlessly create memorable family experiences.** We will achieve this by addressing her most intense drivers: **reducing the frustration of planning** and **alleviating her fear of her children being bored or unhappy.** By providing a seamless and reliable event discovery and management tool, we will drive user acquisition and engagement.