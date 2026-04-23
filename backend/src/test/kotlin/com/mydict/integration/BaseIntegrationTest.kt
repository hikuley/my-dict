package com.mydict.integration

import org.springframework.kafka.test.context.EmbeddedKafka
import org.springframework.test.context.ActiveProfiles

@ActiveProfiles("test", "mock-claude")
@EmbeddedKafka(
    partitions = 1,
    topics = ["word-generate"],
    brokerProperties = ["listeners=PLAINTEXT://localhost:0"]
)
abstract class BaseIntegrationTest
