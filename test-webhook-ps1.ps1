$body = @{
    object = 'whatsapp_business_account'
    entry = @(
        @{
            id = 'TEST'
            changes = @(
                @{
                    value = @{
                        messages = @(
                            @{
                                from = '5511999999999'
                                type = 'interactive'
                                timestamp = '1762966060'
                                interactive = @{
                                    type = 'button_reply'
                                    button_reply = @{
                                        id = 'btn_test'
                                        title = 'Teste'
                                    }
                                }
                            }
                        )
                    }
                    field = 'messages'
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

Write-Host "Testando webhook..."
$response = Invoke-WebRequest -Uri "http://localhost:3001/webhook" -Method POST -Body $body -ContentType "application/json"
Write-Host "Status:" $response.StatusCode
Write-Host "Resposta:" $response.Content





