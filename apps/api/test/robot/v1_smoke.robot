*** Settings ***
Documentation     Local black-box V1 API journey for the Docker-backed KACHKO API.
Library           RequestsLibrary
Library           Collections
Library           OperatingSystem
Suite Setup       Create API Session
Suite Teardown    Delete All Sessions
Test Tags         v1    smoke

*** Variables ***
${BASE_URL}       http://localhost:4000
${CSRF}           1

*** Test Cases ***
V1 owner journey publishes and renders a public page
    ${suffix}=    Evaluate    uuid.uuid4().hex[:10]    modules=uuid
    ${email}=    Set Variable    robot-${suffix}@example.com
    ${username}=    Set Variable    robot-${suffix}
    ${headers}=    Create Dictionary    X-Kachko-CSRF=${CSRF}
    ${register}=    Create Dictionary    email=${email}    password=Robot-password-123    username=${username}    displayName=Robot Tester
    ${response}=    POST On Session    api    /api/v1/auth/register    json=${register}    headers=${headers}    expected_status=201
    ${user}=    Get From Dictionary    ${response.json()}    data
    ${user_id}=    Get From Dictionary    ${user}    id
    Should Be Equal    ${user}[username]    ${username}

    ${response}=    GET On Session    api    /api/v1/auth/me    expected_status=200
    Should Be Equal    ${response.json()}[data][id]    ${user_id}

    ${page_body}=    Create Dictionary    title=Robot page    description=Created by the V1 Robot suite
    ${response}=    POST On Session    api    /api/v1/pages    json=${page_body}    headers=${headers}    expected_status=201
    ${page}=    Get From Dictionary    ${response.json()}    data
    ${page_id}=    Get From Dictionary    ${page}    id

    ${link_content}=    Create Dictionary    title=KACHKO    url=https://kachko.in    openInNewTab=${True}
    ${link}=    Create Dictionary    type=LINK    content=${link_content}
    ${response}=    POST On Session    api    /api/v1/pages/${page_id}/blocks    json=${link}    headers=${headers}    expected_status=201
    ${link_block}=    Get From Dictionary    ${response.json()}    data
    ${text_content}=    Create Dictionary    text=Hello from Robot    alignment=left
    ${text}=    Create Dictionary    type=TEXT    content=${text_content}
    ${response}=    POST On Session    api    /api/v1/pages/${page_id}/blocks    json=${text}    headers=${headers}    expected_status=201
    ${text_block}=    Get From Dictionary    ${response.json()}    data

    ${appearance}=    Create Dictionary    themeKey=dark
    ${response}=    PATCH On Session    api    /api/v1/pages/${page_id}/appearance    json=${appearance}    headers=${headers}    expected_status=200
    Should Be Equal    ${response.json()}[data][themeKey]    dark

    ${social}=    Create Dictionary    platform=GITHUB    username=robot    url=https://github.com/robot
    ${response}=    POST On Session    api    /api/v1/pages/${page_id}/socials    json=${social}    headers=${headers}    expected_status=201
    ${social_id}=    Set Variable    ${response.json()}[data][id]
    Should Not Be Empty    ${social_id}

    ${items}=    Create List
    ${link_item}=    Create Dictionary    id=${link_block}[id]    position=1
    ${text_item}=    Create Dictionary    id=${text_block}[id]    position=0
    Append To List    ${items}    ${link_item}
    Append To List    ${items}    ${text_item}
    ${response}=    POST On Session    api    /api/v1/pages/${page_id}/blocks/reorder    json=${{'items': $items}}    headers=${headers}    expected_status=200

    ${response}=    POST On Session    api    /api/v1/pages/${page_id}/publish    json=${{}}    headers=${headers}    expected_status=200
    ${public}=    Create Session    public    ${BASE_URL}
    ${response}=    GET On Session    public    /api/v1/public/${username}    expected_status=200
    Should Be Equal    ${response.json()}[data][profile][username]    ${username}
    Should Be Equal    ${response.json()}[data][page][themeKey]    dark
    Length Should Be    ${response.json()}[data][blocks]    2

    ${event}=    Create Dictionary    pageId=${page_id}    eventType=PAGE_VIEW
    ${response}=    POST On Session    public    /api/v1/analytics/events    json=${event}    expected_status=202
    Should Be True    ${response.json()}[data][accepted]

    ${response}=    GET On Session    api    /api/v1/pages/${page_id}/analytics/summary?range=7d    expected_status=200
    Should Be Equal As Integers    ${response.json()}[data][totalViews]    1

    ${response}=    GET On Session    api    /api/v1/pages/${page_id}/qr    expected_status=200
    Should Start With    ${response.headers}[Content-Type]    image/png
    Should Be Equal    ${response.headers}[X-Kachko-QR-URL]    http://localhost:3000/@${username}

    ${response}=    POST On Session    api    /api/v1/pages/${page_id}/unpublish    json=${{}}    headers=${headers}    expected_status=200
    GET On Session    public    /api/v1/public/${username}    expected_status=404
    POST On Session    api    /api/v1/auth/logout    headers=${headers}    expected_status=200
    GET On Session    api    /api/v1/auth/me    expected_status=401

Health and readiness endpoints are available
    ${response}=    GET On Session    api    /api/v1/health    expected_status=200
    Should Be Equal    ${response.json()}[data][status]    ok
    ${response}=    GET On Session    api    /api/v1/health/live    expected_status=200
    Should Be Equal    ${response.json()}[data][status]    live
    ${response}=    GET On Session    api    /api/v1/health/ready    expected_status=200
    Should Be Equal    ${response.json()}[data][checks][postgres]    up
    Should Be Equal    ${response.json()}[data][checks][redis]    up

Validation and CSRF protections reject unsafe mutations
    ${response}=    POST On Session    api    /api/v1/auth/login    json=${{'email': 'not-an-email', 'password': 'short'}}    expected_status=403
    Should Be Equal    ${response.json()}[error][code]    CSRF_REJECTED
    ${headers}=    Create Dictionary    X-Kachko-CSRF=${CSRF}
    ${response}=    POST On Session    api    /api/v1/auth/login    json=${{'email': 'not-an-email', 'password': 'short'}}    headers=${headers}    expected_status=400
    Should Be Equal    ${response.json()}[error][code]    VALIDATION_ERROR

*** Keywords ***
Create API Session
    Create Session    api    ${BASE_URL}
